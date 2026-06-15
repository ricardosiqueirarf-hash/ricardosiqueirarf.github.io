import os
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

import requests
from flask import jsonify, request

try:
    from zoneinfo import ZoneInfo
except Exception:  # pragma: no cover
    ZoneInfo = None

from asaas_client import criar_cobranca_boleto, obter_ou_criar_cliente


TABELA_ASAAS_COBRANCAS = os.getenv("SUPABASE_TABLE_ASAAS_COBRANCAS", "asaas_cobrancas")
LAST_APPROVAL_BOLETOS = {}
LAST_APPROVAL_ERROS = {}
INSTALADO = False


def _headers_json(headers):
    return {**headers, "Content-Type": "application/json", "Prefer": "return=representation"}


def _agora_fortaleza_date():
    if ZoneInfo:
        return datetime.now(ZoneInfo("America/Fortaleza")).date()
    return datetime.now(timezone.utc).date()


def _adicionar_dias_uteis(data_base, dias):
    atual = data_base
    adicionados = 0
    while adicionados < dias:
        atual += timedelta(days=1)
        if atual.weekday() < 5:
            adicionados += 1
    return atual


def _valor_decimal(valor):
    return Decimal(str(valor or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _somente_digitos(valor):
    return re.sub(r"\D+", "", str(valor or ""))


def _money_br(valor):
    numero = _valor_decimal(valor)
    texto = f"{numero:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {texto}"


def _buscar_orcamento(uuid):
    from app import SUPABASE_URL, HEADERS

    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/orcamentos"
        f"?select=id,numero_pedido,cliente_nome,valor_total,userid,lojaid,status"
        f"&id=eq.{uuid}&limit=1",
        headers=HEADERS,
        timeout=20,
    )
    r.raise_for_status()
    itens = r.json() or []
    return itens[0] if itens else None


def _buscar_usuario_por_orcamento(orcamento):
    from app import SUPABASE_URL, HEADERS

    candidatos = []
    userid = orcamento.get("userid")
    lojaid = orcamento.get("lojaid")

    if userid:
        candidatos.append(("userid", userid))
    if lojaid:
        candidatos.append(("storeid", lojaid))

    for coluna, valor in candidatos:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/usuarios"
            f"?select=userid,user,nome,dados,storeid&{coluna}=eq.{valor}&limit=1",
            headers=HEADERS,
            timeout=20,
        )
        r.raise_for_status()
        itens = r.json() or []
        if itens:
            return itens[0]

    return None


def _dados_cliente_cobranca(orcamento, usuario):
    usuario = usuario or {}
    dados = usuario.get("dados") or {}
    if not isinstance(dados, dict):
        dados = {}

    nome = (
        dados.get("nome")
        or usuario.get("nome")
        or orcamento.get("cliente_nome")
        or usuario.get("user")
        or ""
    ).strip()

    cliente = {
        "nome": nome,
        "cpf_cnpj": dados.get("cpf_cnpj") or dados.get("cpfCnpj") or dados.get("documento"),
        "email": dados.get("email"),
        "whatsapp": dados.get("whatsapp") or dados.get("telefone") or dados.get("celular"),
        "cep": dados.get("cep"),
        "endereco": dados.get("endereco"),
        "external_reference": str(usuario.get("userid") or orcamento.get("id") or ""),
    }

    faltando = []
    if not cliente["nome"]:
        faltando.append("nome")
    if not _somente_digitos(cliente.get("cpf_cnpj")):
        faltando.append("cpf_cnpj")
    if not cliente.get("email"):
        faltando.append("email")
    if not _somente_digitos(cliente.get("whatsapp")):
        faltando.append("whatsapp")

    if faltando:
        raise ValueError(
            "Dados insuficientes para gerar boleto no Asaas. Faltando: " + ", ".join(faltando)
        )

    return cliente


def _listar_boletos_salvos(uuid):
    from app import SUPABASE_URL, HEADERS

    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/{TABELA_ASAAS_COBRANCAS}"
        f"?select=*&orcamento_id=eq.{uuid}&order=parcela.asc",
        headers=HEADERS,
        timeout=20,
    )
    r.raise_for_status()
    return r.json() or []


def _salvar_cobranca(orcamento, cliente, parcela, valor, vencimento, customer_id, cobranca):
    from app import SUPABASE_URL, HEADERS

    external_reference = f"orcamento:{orcamento.get('id')}:parcela:{parcela}"
    payload = {
        "orcamento_id": orcamento.get("id"),
        "numero_pedido": int(float(orcamento.get("numero_pedido") or 0)) if orcamento.get("numero_pedido") is not None else None,
        "cliente_nome": cliente.get("nome") or orcamento.get("cliente_nome"),
        "cliente_documento": _somente_digitos(cliente.get("cpf_cnpj")),
        "cliente_email": cliente.get("email"),
        "cliente_whatsapp": _somente_digitos(cliente.get("whatsapp")),
        "parcela": parcela,
        "percentual": 50,
        "valor": float(_valor_decimal(valor)),
        "vencimento": vencimento.isoformat(),
        "asaas_customer_id": customer_id,
        "asaas_payment_id": cobranca.get("id"),
        "external_reference": external_reference,
        "status": cobranca.get("status"),
        "invoice_url": cobranca.get("invoiceUrl") or cobranca.get("invoice_url"),
        "bank_slip_url": cobranca.get("bankSlipUrl") or cobranca.get("bank_slip_url"),
        "payload": cobranca,
    }

    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/{TABELA_ASAAS_COBRANCAS}",
        headers=_headers_json(HEADERS),
        json=payload,
        timeout=20,
    )
    r.raise_for_status()
    itens = r.json() or []
    return itens[0] if itens else payload


def emitir_boletos_asaas_50_50(uuid):
    existentes = _listar_boletos_salvos(uuid)
    if len(existentes) >= 2:
        return existentes

    orcamento = _buscar_orcamento(uuid)
    if not orcamento:
        raise ValueError("Orçamento não encontrado para emissão de boleto.")

    valor_total = _valor_decimal(orcamento.get("valor_total"))
    if valor_total <= 0:
        raise ValueError("Valor total do orçamento precisa ser maior que zero.")

    usuario = _buscar_usuario_por_orcamento(orcamento)
    cliente = _dados_cliente_cobranca(orcamento, usuario)
    cliente_asaas = obter_ou_criar_cliente(cliente)
    customer_id = cliente_asaas.get("id")
    if not customer_id:
        raise ValueError("Asaas não retornou ID do cliente.")

    hoje = _agora_fortaleza_date()
    vencimento_1 = hoje
    vencimento_2 = _adicionar_dias_uteis(hoje, 8)

    valor_1 = (valor_total / Decimal("2")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    valor_2 = (valor_total - valor_1).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    numero_pedido = orcamento.get("numero_pedido") or "-"
    specs = [
        (1, valor_1, vencimento_1, f"Pedido {numero_pedido} - Entrada 50%"),
        (2, valor_2, vencimento_2, f"Pedido {numero_pedido} - Saldo 50%"),
    ]

    boletos = []
    for parcela, valor, vencimento, descricao in specs:
        external_reference = f"orcamento:{uuid}:parcela:{parcela}"

        if any(str(item.get("external_reference")) == external_reference for item in existentes):
            continue

        cobranca = criar_cobranca_boleto(
            customer_id=customer_id,
            valor=valor,
            vencimento=vencimento,
            descricao=descricao,
            external_reference=external_reference,
        )
        boletos.append(_salvar_cobranca(orcamento, cliente, parcela, valor, vencimento, customer_id, cobranca))

    return _listar_boletos_salvos(uuid)


def _formatar_boletos_telegram(uuid, boletos):
    linhas = ["Pedido aprovado.", "", "Boletos Asaas gerados:"]
    for boleto in boletos:
        link = boleto.get("invoice_url") or boleto.get("bank_slip_url") or "link não retornado"
        linhas.append(
            f"Parcela {boleto.get('parcela')} - {_money_br(boleto.get('valor'))} - venc. {boleto.get('vencimento')}:\n{link}"
        )
    linhas.append("")
    linhas.append(f"UUID: {uuid}")
    return "\n".join(linhas)


def _extrair_uuid_mensagem(message):
    texto = (message or {}).get("text") or ""
    match = re.search(r"UUID:\s*([0-9a-fA-F-]{20,})", texto)
    return match.group(1).strip() if match else ""


def _validar_token_webhook():
    esperado = os.getenv("ASAAS_WEBHOOK_TOKEN") or ""
    if not esperado:
        return True

    recebido = (
        request.headers.get("X-Webhook-Token")
        or request.headers.get("asaas-access-token")
        or request.headers.get("access_token")
        or request.args.get("token")
        or (request.get_json(silent=True) or {}).get("webhook_token")
        or ""
    )
    return recebido == esperado


def _registrar_endpoint_boletos(module):
    bp = module.orcamentos_bp

    @bp.route("/api/orcamento/<uuid>/boletos", methods=["GET"])
    def listar_boletos_asaas(uuid):
        try:
            boletos = _listar_boletos_salvos(uuid)
            return jsonify({"success": True, "boletos": boletos})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 500

    @bp.route("/api/orcamento/<uuid>/emitir-boletos-asaas", methods=["POST"])
    def emitir_boletos_asaas_manual(uuid):
        try:
            boletos = emitir_boletos_asaas_50_50(uuid)
            return jsonify({"success": True, "boletos": boletos})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 500

    @bp.route("/api/asaas/webhook", methods=["GET", "POST"])
    def asaas_webhook():
        if request.method == "GET":
            return jsonify({"success": True, "message": "Webhook Asaas ativo"})

        if not _validar_token_webhook():
            return jsonify({"success": False, "error": "Token do webhook inválido."}), 401

        data = request.get_json(silent=True) or {}
        payment = data.get("payment") or {}
        payment_id = payment.get("id")
        status = payment.get("status")

        if not payment_id:
            return jsonify({"success": True, "message": "Evento ignorado: payment.id ausente."})

        try:
            from app import SUPABASE_URL, HEADERS
            r = requests.patch(
                f"{SUPABASE_URL}/rest/v1/{TABELA_ASAAS_COBRANCAS}?asaas_payment_id=eq.{payment_id}",
                headers=_headers_json(HEADERS),
                json={"status": status, "payload": data},
                timeout=20,
            )
            r.raise_for_status()
            return jsonify({"success": True, "payment_id": payment_id, "status": status})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 500


def install(module):
    global INSTALADO
    if INSTALADO:
        return

    original_aprovar = module._aprovar_orcamento_por_telegram
    original_editar = module._editar_mensagem_telegram

    def aprovar_com_asaas(uuid):
        resultado = original_aprovar(uuid)
        if not resultado.get("success"):
            return resultado

        try:
            boletos = emitir_boletos_asaas_50_50(uuid)
            LAST_APPROVAL_BOLETOS[uuid] = boletos
            LAST_APPROVAL_ERROS.pop(uuid, None)
            resultado["asaas_success"] = True
            resultado["boletos"] = boletos
        except Exception as exc:
            LAST_APPROVAL_ERROS[uuid] = str(exc)
            resultado["asaas_success"] = False
            resultado["asaas_error"] = str(exc)

        return resultado

    def editar_mensagem_com_boletos(message, texto):
        if texto == "Pedido aprovado":
            uuid = _extrair_uuid_mensagem(message)
            if uuid and uuid in LAST_APPROVAL_BOLETOS:
                texto = _formatar_boletos_telegram(uuid, LAST_APPROVAL_BOLETOS[uuid])
            elif uuid and uuid in LAST_APPROVAL_ERROS:
                texto = (
                    "Pedido aprovado.\n\n"
                    "Boletos Asaas não foram gerados automaticamente.\n"
                    f"Motivo: {LAST_APPROVAL_ERROS[uuid]}\n\n"
                    f"UUID: {uuid}"
                )
        return original_editar(message, texto)

    module._aprovar_orcamento_por_telegram = aprovar_com_asaas
    module._editar_mensagem_telegram = editar_mensagem_com_boletos
    _registrar_endpoint_boletos(module)
    INSTALADO = True
    print("[ASAAS] Integração de boletos instalada no fluxo de aprovação Telegram.")
