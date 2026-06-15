import os
import requests
from flask import Blueprint, jsonify, request

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
# HELPERS
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


def _asaas_headers_json():
    return {**HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"}


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
        headers=_asaas_headers_json(),
        json={"status": status, "payload": payload},
        timeout=20,
    )
    r.raise_for_status()
    return r.json() if r.content else []


def _consultar_asaas_payment(payment_id):
    from asaas_client import consultar_cobranca
    return consultar_cobranca(payment_id)

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
# Registradas aqui porque fornecedores_bp já é importado e registrado no app.py.
# Não altera tabelas existentes; apenas consulta/atualiza asaas_cobrancas.
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
        # Se a cobrança foi excluída/cancelada no Asaas, algumas consultas podem voltar 404.
        # Como o payment_id já existia na nossa base, marcamos como CANCELLED_NOT_FOUND
        # para ele sair do A Receber aberto, mantendo histórico.
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
