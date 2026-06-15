import os
from datetime import date, datetime, timedelta, timezone

import requests
from flask import Blueprint, jsonify, request, send_from_directory

try:
    from zoneinfo import ZoneInfo
except Exception:  # pragma: no cover
    ZoneInfo = None

# =====================
# CONFIG SUPABASE
# =====================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
SUPABASE_TABLE_FORNECEDORES = os.getenv("SUPABASE_TABLE_FORNECEDORES", "fornecedores")
SUPABASE_TABLE_ASAAS_COBRANCAS = os.getenv("SUPABASE_TABLE_ASAAS_COBRANCAS", "asaas_cobrancas")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL ou chave do Supabase não configurados")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# =====================
# BLUEPRINT
# =====================

fornecedores_bp = Blueprint("fornecedores_bp", __name__)

# =====================
# INSTALAÇÃO DO PATCH ASAAS NO FLUXO DO TELEGRAM
# api_fornecedores.py já é importado pelo app.py depois de api_orcamentos.py.
# Por isso este ponto é confiável para ligar a emissão 50/50 sem editar api_orcamentos.py.
# =====================

try:
    import api_orcamentos as _api_orcamentos
    import asaas_orcamentos_patch as _asaas_orcamentos_patch
    _asaas_orcamentos_patch.install(_api_orcamentos)
except Exception as exc:
    print(f"[ASAAS] Falha ao instalar patch de boletos no Telegram: {exc}")

# =====================
# HELPERS GERAIS
# =====================


def _supabase_url(query=""):
    base = f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE_FORNECEDORES}"
    return f"{base}{query}"


def _normalizar_produtos_e_precos(valor):
    if isinstance(valor, dict):
        return valor
    return {}


def _validar_payload(data):
    fornecedor = (data.get("fornecedor") or "").strip()
    if not fornecedor:
        return None, (jsonify({"error": "O campo fornecedor é obrigatório"}), 400)

    produtos_e_precos = _normalizar_produtos_e_precos(data.get("produtos_e_precos"))
    return {
        "fornecedor": fornecedor,
        "produtos_e_precos": produtos_e_precos,
    }, None


def _resposta_supabase(response):
    response.raise_for_status()
    data = response.json() if response.content else []
    return jsonify(data)


def _headers_json():
    return {**HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"}


def _hoje_fortaleza():
    if ZoneInfo:
        return datetime.now(ZoneInfo("America/Fortaleza")).date()
    return datetime.now(timezone.utc).date()


def _parse_date(valor):
    if not valor:
        return None
    if isinstance(valor, date):
        return valor
    texto = str(valor)[:10]
    try:
        return date.fromisoformat(texto)
    except ValueError:
        return None


def _valor_float(valor):
    try:
        return float(valor or 0)
    except (TypeError, ValueError):
        return 0.0

# =====================
# HELPERS ASAAS
# =====================


def _validar_token_webhook_asaas():
    esperado = os.getenv("ASAAS_WEBHOOK_TOKEN") or ""
    if not esperado:
        return True

    data = request.get_json(silent=True) or {}
    recebido = (
        request.headers.get("X-Webhook-Token")
        or request.headers.get("asaas-access-token")
        or request.headers.get("access_token")
        or request.args.get("token")
        or data.get("webhook_token")
        or ""
    )
    return recebido == esperado


def _extrair_payment_do_webhook(data):
    data = data or {}
    payment = data.get("payment") or data.get("pagamento") or {}
    if not isinstance(payment, dict):
        payment = {}

    payment_id = (
        payment.get("id")
        or data.get("payment_id")
        or data.get("paymentId")
        or data.get("id")
    )
    status = payment.get("status") or data.get("status")
    evento = data.get("event") or data.get("eventType") or data.get("type")

    if not status and evento:
        evento_str = str(evento).upper()
        if "DELETED" in evento_str or "CANCEL" in evento_str:
            status = "CANCELLED"
        elif "RECEIVED" in evento_str:
            status = "RECEIVED"
        elif "CONFIRMED" in evento_str:
            status = "CONFIRMED"
        elif "OVERDUE" in evento_str:
            status = "OVERDUE"

    return payment_id, status, evento


def _atualizar_cobranca_por_payment_id(payment_id, status, payload):
    if not payment_id:
        return []

    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE_ASAAS_COBRANCAS}?asaas_payment_id=eq.{payment_id}",
        headers=_headers_json(),
        json={"status": status, "payload": payload},
        timeout=20,
    )
    r.raise_for_status()
    return r.json() if r.content else []


def _consultar_asaas_payment(payment_id):
    from asaas_client import consultar_cobranca
    return consultar_cobranca(payment_id)

# =====================
# HELPERS A RECEBER
# =====================


STATUS_RECEBIDOS = {"RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "RECEIVED_MANUAL", "MANUAL_RECEIVED"}
STATUS_CANCELADOS = {"CANCELLED", "DELETED", "CANCELLED_LOCAL", "CANCELLED_NOT_FOUND", "REFUNDED"}


def _status_financeiro(item, hoje=None):
    hoje = hoje or _hoje_fortaleza()
    raw = str(item.get("status") or "PENDING").upper().strip()
    vencimento = _parse_date(item.get("vencimento"))

    if raw in STATUS_RECEBIDOS:
        return "recebido", "Recebido"
    if raw in STATUS_CANCELADOS or "CANCEL" in raw or "DELETED" in raw:
        return "cancelado", "Cancelado"
    if raw == "OVERDUE":
        return "vencido", "Vencido"
    if vencimento:
        if vencimento < hoje:
            return "vencido", "Vencido"
        if vencimento == hoje:
            return "vence_hoje", "Vence hoje"
    return "a_vencer", "A vencer"


def _normalizar_recebivel(item, hoje=None):
    hoje = hoje or _hoje_fortaleza()
    status_categoria, status_label = _status_financeiro(item, hoje)
    valor = _valor_float(item.get("valor"))
    vencimento = _parse_date(item.get("vencimento"))

    return {
        "id": item.get("id"),
        "orcamento_id": item.get("orcamento_id"),
        "numero_pedido": item.get("numero_pedido"),
        "cliente_nome": item.get("cliente_nome"),
        "parcela": item.get("parcela"),
        "percentual": _valor_float(item.get("percentual")),
        "valor": valor,
        "vencimento": vencimento.isoformat() if vencimento else item.get("vencimento"),
        "asaas_payment_id": item.get("asaas_payment_id"),
        "external_reference": item.get("external_reference"),
        "status_raw": item.get("status") or "PENDING",
        "status_categoria": status_categoria,
        "status_label": status_label,
        "invoice_url": item.get("invoice_url"),
        "bank_slip_url": item.get("bank_slip_url"),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
        "dias_para_vencer": (vencimento - hoje).days if vencimento else None,
    }


def _listar_cobrancas_asaas():
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE_ASAAS_COBRANCAS}"
        "?select=id,created_at,updated_at,orcamento_id,numero_pedido,cliente_nome,parcela,percentual,valor,vencimento,asaas_payment_id,external_reference,status,invoice_url,bank_slip_url,payload"
        "&order=vencimento.asc&order=numero_pedido.asc&limit=1000",
        headers=HEADERS,
        timeout=20,
    )
    r.raise_for_status()
    return r.json() or []


def _buscar_cobranca_por_id(cobranca_id):
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE_ASAAS_COBRANCAS}?select=*&id=eq.{cobranca_id}&limit=1",
        headers=HEADERS,
        timeout=20,
    )
    r.raise_for_status()
    itens = r.json() or []
    return itens[0] if itens else None


def _patch_cobranca_por_id(cobranca_id, payload):
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE_ASAAS_COBRANCAS}?id=eq.{cobranca_id}",
        headers=_headers_json(),
        json=payload,
        timeout=20,
    )
    r.raise_for_status()
    itens = r.json() if r.content else []
    return itens[0] if itens else None


def _calcular_resumo(itens):
    hoje = _hoje_fortaleza()
    inicio_mes = hoje.replace(day=1)
    fim_7 = hoje + timedelta(days=7)
    fim_30 = hoje + timedelta(days=30)

    resumo = {
        "total_aberto": 0.0,
        "vence_hoje": 0.0,
        "vencidos": 0.0,
        "a_vencer_7_dias": 0.0,
        "a_vencer_30_dias": 0.0,
        "recebido_mes": 0.0,
        "cancelados": 0.0,
        "quantidade_abertos": 0,
        "quantidade_recebidos": 0,
        "quantidade_cancelados": 0,
        "hoje": hoje.isoformat(),
    }

    for item in itens:
        valor = _valor_float(item.get("valor"))
        categoria = item.get("status_categoria")
        vencimento = _parse_date(item.get("vencimento"))

        if categoria in {"a_vencer", "vence_hoje", "vencido"}:
            resumo["total_aberto"] += valor
            resumo["quantidade_abertos"] += 1
        if categoria == "vence_hoje":
            resumo["vence_hoje"] += valor
        if categoria == "vencido":
            resumo["vencidos"] += valor
        if categoria in {"a_vencer", "vence_hoje"} and vencimento:
            if hoje <= vencimento <= fim_7:
                resumo["a_vencer_7_dias"] += valor
            if hoje <= vencimento <= fim_30:
                resumo["a_vencer_30_dias"] += valor
        if categoria == "recebido":
            resumo["quantidade_recebidos"] += 1
            # MVP: usa updated_at quando não há data específica de pagamento no payload.
            data_ref = _parse_date(item.get("updated_at")) or vencimento
            if data_ref and data_ref >= inicio_mes:
                resumo["recebido_mes"] += valor
        if categoria == "cancelado":
            resumo["cancelados"] += valor
            resumo["quantidade_cancelados"] += 1

    for chave, valor in list(resumo.items()):
        if isinstance(valor, float):
            resumo[chave] = round(valor, 2)
    return resumo


def _filtrar_recebiveis(itens, periodo="aberto", busca=""):
    hoje = _hoje_fortaleza()
    periodo = (periodo or "aberto").strip().lower()
    busca = (busca or "").strip().lower()
    fim_7 = hoje + timedelta(days=7)
    fim_mes = hoje + timedelta(days=31)

    filtrados = []
    for item in itens:
        categoria = item.get("status_categoria")
        vencimento = _parse_date(item.get("vencimento"))

        ok = True
        if periodo == "aberto":
            ok = categoria in {"a_vencer", "vence_hoje", "vencido"}
        elif periodo == "hoje":
            ok = categoria == "vence_hoje"
        elif periodo == "7dias":
            ok = categoria in {"a_vencer", "vence_hoje"} and vencimento and hoje <= vencimento <= fim_7
        elif periodo == "mes":
            ok = categoria in {"a_vencer", "vence_hoje"} and vencimento and hoje <= vencimento <= fim_mes
        elif periodo == "vencidos":
            ok = categoria == "vencido"
        elif periodo == "recebidos":
            ok = categoria == "recebido"
        elif periodo == "cancelados":
            ok = categoria == "cancelado"
        elif periodo == "todos":
            ok = True

        if ok and busca:
            texto = " ".join([
                str(item.get("numero_pedido") or ""),
                str(item.get("cliente_nome") or ""),
                str(item.get("asaas_payment_id") or ""),
                str(item.get("status_raw") or ""),
            ]).lower()
            ok = busca in texto

        if ok:
            filtrados.append(item)

    return filtrados

# =====================
# ROTAS DE PÁGINA
# =====================


@fornecedores_bp.route("/a_receber")
@fornecedores_bp.route("/a_receber.html")
@fornecedores_bp.route("/financeiro/a-receber")
def a_receber_page():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    static_dir = os.path.join(root_dir, "static")
    return send_from_directory(static_dir, "a_receber.html")

# =====================
# ROTAS FORNECEDORES
# =====================


@fornecedores_bp.route("/api/fornecedores", methods=["GET"])
def listar_fornecedores():
    try:
        r = requests.get(
            _supabase_url("?select=id,fornecedor,produtos_e_precos&order=fornecedor.asc"),
            headers=HEADERS,
        )
        return _resposta_supabase(r)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@fornecedores_bp.route("/api/fornecedores", methods=["POST"])
def criar_fornecedor():
    try:
        data = request.json or {}
        payload, erro = _validar_payload(data)
        if erro:
            return erro

        r = requests.post(
            _supabase_url(),
            headers=HEADERS,
            json=payload,
        )
        return _resposta_supabase(r), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@fornecedores_bp.route("/api/fornecedores/<int:fornecedor_id>", methods=["PUT", "PATCH"])
def editar_fornecedor(fornecedor_id):
    try:
        data = request.json or {}
        payload, erro = _validar_payload(data)
        if erro:
            return erro

        r = requests.patch(
            _supabase_url(f"?id=eq.{fornecedor_id}"),
            headers=HEADERS,
            json=payload,
        )
        return _resposta_supabase(r)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@fornecedores_bp.route("/api/fornecedores/<int:fornecedor_id>", methods=["DELETE"])
def deletar_fornecedor(fornecedor_id):
    try:
        r = requests.delete(
            _supabase_url(f"?id=eq.{fornecedor_id}"),
            headers=HEADERS,
        )
        r.raise_for_status()
        return jsonify({"status": "deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =====================
# ROTAS ASAAS
# =====================


@fornecedores_bp.route("/api/asaas/status", methods=["GET"])
def asaas_status():
    return jsonify({
        "success": True,
        "message": "Integração Asaas carregada",
        "has_api_key": bool(os.getenv("ASAAS_API_KEY")),
        "base_url": os.getenv("ASAAS_BASE_URL") or "https://api.asaas.com/v3",
    })


@fornecedores_bp.route("/api/asaas/webhook", methods=["GET", "POST"])
def asaas_webhook():
    if request.method == "GET":
        return jsonify({
            "success": True,
            "message": "Webhook Asaas ativo",
            "methods": ["GET", "POST"],
        })

    if not _validar_token_webhook_asaas():
        return jsonify({"success": False, "error": "Token do webhook inválido."}), 401

    data = request.get_json(silent=True) or {}
    payment_id, status, evento = _extrair_payment_do_webhook(data)

    if not payment_id:
        return jsonify({
            "success": True,
            "message": "Evento ignorado: payment.id ausente.",
            "event": evento,
        })

    if not status:
        status = "EVENT_RECEIVED"

    try:
        registros = _atualizar_cobranca_por_payment_id(payment_id, status, data)
        return jsonify({
            "success": True,
            "payment_id": payment_id,
            "status": status,
            "event": evento,
            "updated": len(registros),
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@fornecedores_bp.route("/api/asaas/sync/<payment_id>", methods=["POST", "GET"])
def sincronizar_cobranca_asaas(payment_id):
    """Consulta o status atual direto no Asaas e atualiza asaas_cobrancas.

    Use token=<ASAAS_WEBHOOK_TOKEN> na query ou envie o mesmo token em X-Webhook-Token.
    """
    if not _validar_token_webhook_asaas():
        return jsonify({"success": False, "error": "Token inválido para sincronização."}), 401

    try:
        cobranca = _consultar_asaas_payment(payment_id)
        status = cobranca.get("status") or "SYNCED"
        registros = _atualizar_cobranca_por_payment_id(payment_id, status, cobranca)
        return jsonify({
            "success": True,
            "payment_id": payment_id,
            "status": status,
            "updated": len(registros),
            "asaas": cobranca,
        })
    except Exception as e:
        erro = str(e)
        if "HTTP 404" in erro or "not found" in erro.lower() or "não encontrada" in erro.lower():
            payload = {"sync_error": erro, "status_assumido": "CANCELLED_NOT_FOUND"}
            registros = _atualizar_cobranca_por_payment_id(payment_id, "CANCELLED_NOT_FOUND", payload)
            return jsonify({
                "success": True,
                "payment_id": payment_id,
                "status": "CANCELLED_NOT_FOUND",
                "updated": len(registros),
                "warning": "Cobrança não encontrada no Asaas; marcada como cancelada/não encontrada.",
            })
        return jsonify({"success": False, "error": erro}), 500

# =====================
# ROTAS ERP FINANCEIRO - A RECEBER
# =====================


@fornecedores_bp.route("/api/financeiro/a-receber", methods=["GET"])
def financeiro_a_receber():
    try:
        periodo = request.args.get("periodo") or "aberto"
        busca = request.args.get("q") or ""
        hoje = _hoje_fortaleza()
        cobrancas_raw = _listar_cobrancas_asaas()
        itens = [_normalizar_recebivel(item, hoje) for item in cobrancas_raw]
        resumo = _calcular_resumo(itens)
        filtrados = _filtrar_recebiveis(itens, periodo=periodo, busca=busca)
        return jsonify({
            "success": True,
            "periodo": periodo,
            "q": busca,
            "resumo": resumo,
            "itens": filtrados,
            "total_filtrado": len(filtrados),
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@fornecedores_bp.route("/api/financeiro/a-receber/<cobranca_id>/baixar-manual", methods=["POST"])
def financeiro_baixar_manual(cobranca_id):
    data = request.get_json(silent=True) or {}
    forma = (data.get("forma_pagamento") or "dinheiro").strip().lower()
    observacao = (data.get("observacao") or "").strip()
    data_pagamento = (data.get("data_pagamento") or _hoje_fortaleza().isoformat()).strip()

    try:
        cobranca = _buscar_cobranca_por_id(cobranca_id)
        if not cobranca:
            return jsonify({"success": False, "error": "Cobrança não encontrada."}), 404

        payload_anterior = cobranca.get("payload") if isinstance(cobranca.get("payload"), dict) else {}
        payload = {
            **payload_anterior,
            "baixa_manual": {
                "forma_pagamento": forma,
                "observacao": observacao,
                "data_pagamento": data_pagamento,
                "registrado_em": datetime.now(timezone.utc).isoformat(),
            },
            "status_anterior": cobranca.get("status"),
        }
        atualizado = _patch_cobranca_por_id(cobranca_id, {"status": "RECEIVED_MANUAL", "payload": payload})
        return jsonify({"success": True, "cobranca": atualizado})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@fornecedores_bp.route("/api/financeiro/a-receber/<cobranca_id>/cancelar-local", methods=["POST"])
def financeiro_cancelar_local(cobranca_id):
    data = request.get_json(silent=True) or {}
    motivo = (data.get("motivo") or "Cancelado manualmente no ERP").strip()

    try:
        cobranca = _buscar_cobranca_por_id(cobranca_id)
        if not cobranca:
            return jsonify({"success": False, "error": "Cobrança não encontrada."}), 404

        payload_anterior = cobranca.get("payload") if isinstance(cobranca.get("payload"), dict) else {}
        payload = {
            **payload_anterior,
            "cancelamento_local": {
                "motivo": motivo,
                "registrado_em": datetime.now(timezone.utc).isoformat(),
            },
            "status_anterior": cobranca.get("status"),
        }
        atualizado = _patch_cobranca_por_id(cobranca_id, {"status": "CANCELLED_LOCAL", "payload": payload})
        return jsonify({"success": True, "cobranca": atualizado})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@fornecedores_bp.route("/api/financeiro/a-receber/<cobranca_id>/sincronizar", methods=["POST"])
def financeiro_sincronizar_recebivel(cobranca_id):
    try:
        cobranca = _buscar_cobranca_por_id(cobranca_id)
        if not cobranca:
            return jsonify({"success": False, "error": "Cobrança não encontrada."}), 404
        payment_id = cobranca.get("asaas_payment_id")
        if not payment_id:
            return jsonify({"success": False, "error": "Cobrança sem asaas_payment_id."}), 400

        try:
            cobranca_asaas = _consultar_asaas_payment(payment_id)
            status = cobranca_asaas.get("status") or "SYNCED"
            registros = _atualizar_cobranca_por_payment_id(payment_id, status, cobranca_asaas)
            return jsonify({"success": True, "status": status, "updated": len(registros), "asaas": cobranca_asaas})
        except Exception as sync_error:
            erro = str(sync_error)
            if "HTTP 404" in erro or "not found" in erro.lower() or "não encontrada" in erro.lower():
                payload = {"sync_error": erro, "status_assumido": "CANCELLED_NOT_FOUND"}
                registros = _atualizar_cobranca_por_payment_id(payment_id, "CANCELLED_NOT_FOUND", payload)
                return jsonify({"success": True, "status": "CANCELLED_NOT_FOUND", "updated": len(registros)})
            raise
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
