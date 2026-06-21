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
LAST_PENDING_PARCELAMENTO = set()
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


def _max_parcelas_telegram():
    try:
        max_parcelas = int(os.getenv("ASAAS_MAX_PARCELAS_TELEGRAM", "6") or 6)
    except (TypeError, ValueError):
        max_parcelas = 6
    return max(1, min(max_parcelas, 12))


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


def _salvar_cobranca(orcamento, cliente, parcela, valor, vencimento, customer_id, cobranca, percentual):
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
        "percentual": float(percentual),
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


def _dividir_valor_em_parcelas(valor_total, parcelas):
    parcelas = max(1, int(parcelas))
    valor_total = _valor_decimal(valor_total)
    valor_base = (valor_total / Decimal(parcelas)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    valores = [valor_base for _ in range(parcelas)]
    diferenca = valor_total - sum(valores, Decimal("0.00"))
    valores[-1] = (valores[-1] + diferenca).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return valores


def emitir_boletos_asaas_parcelado(uuid, parcelas=2):
    try:
        parcelas = int(parcelas)
    except (TypeError, ValueError):
        parcelas = 2
    parcelas = max(1, min(parcelas, _max_parcelas_telegram()))

    existentes = _listar_boletos_salvos(uuid)
    if len(existentes) >= parcelas:
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
    valores = _dividir_valor_em_parcelas(valor_total, parcelas)
    percentual = (Decimal("100") / Decimal(parcelas)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    numero_pedido = orcamento.get("numero_pedido") or "-"

    boletos = []
    for indice, valor in enumerate(valores, start=1):
        vencimento = hoje if indice == 1 else _adicionar_dias_uteis(hoje, 7 * (indice - 1))
        descricao = f"Pedido {numero_pedido} - Parcela {indice}/{parcelas}"
        external_reference = f"orcamento:{uuid}:parcela:{indice}"

        if any(str(item.get("external_reference")) == external_reference for item in existentes):
            continue

        cobranca = criar_cobranca_boleto(
            customer_id=customer_id,
            valor=valor,
            vencimento=vencimento,
            descricao=descricao,
            external_reference=external_reference,
        )
        boletos.append(_salvar_cobranca(orcamento, cliente, indice, valor, vencimento, customer_id, cobranca, percentual))

    return _listar_boletos_salvos(uuid)


def emitir_boletos_asaas_50_50(uuid):
    return emitir_boletos_asaas_parcelado(uuid, 2)


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


def _parse_parcelamento_callback(callback_data):
    partes = str(callback_data or "").split(":")
    if len(partes) != 3 or partes[0] != "parcelar_orcamento":
        return None, None
    uuid = partes[1].strip()
    try:
        parcelas = int(partes[2])
    except (TypeError, ValueError):
        return None, None
    if not uuid or parcelas < 1 or parcelas > _max_parcelas_telegram():
        return None, None
    return uuid, parcelas


def _parcelas_token(uuid, parcelas):
    return f"{uuid}::parcelas::{parcelas}"


def _parse_parcelas_token(valor):
    texto = str(valor or "")
    if "::parcelas::" not in texto:
        return texto, None
    uuid, parcelas_texto = texto.split("::parcelas::", 1)
    try:
        parcelas = int(parcelas_texto)
    except (TypeError, ValueError):
        parcelas = None
    return uuid.strip(), parcelas


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
        data = request.get_json(silent=True) or {}
        parcelas = data.get("parcelas") or data.get("quantidade_parcelas") or 2
        try:
            boletos = emitir_boletos_asaas_parcelado(uuid, parcelas)
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

    original_validar = module._validar_callback_orcamento
    original_aprovar = module._aprovar_orcamento_por_telegram
    original_editar = module._editar_mensagem_telegram
    original_responder = module._responder_callback_telegram

    def validar_callback_com_parcelamento(callback_data):
        uuid_parcela, parcelas = _parse_parcelamento_callback(callback_data)
        if uuid_parcela and parcelas:
            return "aprovar_orcamento", _parcelas_token(uuid_parcela, parcelas)
        return original_validar(callback_data)

    def aprovar_com_asaas(uuid):
        uuid_real, parcelas = _parse_parcelas_token(uuid)
        if not parcelas:
            LAST_PENDING_PARCELAMENTO.add(uuid_real)
            return {"success": True, "parcelamento_pendente": True, "uuid": uuid_real}

        resultado = original_aprovar(uuid_real)
        if not resultado.get("success"):
            return resultado

        try:
            boletos = emitir_boletos_asaas_parcelado(uuid_real, parcelas)
            LAST_APPROVAL_BOLETOS[uuid_real] = boletos
            LAST_APPROVAL_ERROS.pop(uuid_real, None)
            LAST_PENDING_PARCELAMENTO.discard(uuid_real)
            resultado["asaas_success"] = True
            resultado["parcelas"] = parcelas
            resultado["boletos"] = boletos
        except Exception as exc:
            LAST_APPROVAL_ERROS[uuid_real] = str(exc)
            LAST_PENDING_PARCELAMENTO.discard(uuid_real)
            resultado["asaas_success"] = False
            resultado["asaas_error"] = str(exc)

        return resultado

    def responder_callback_com_parcelamento(callback_query_id, texto):
        if texto == "Pedido aprovado":
            texto = "Escolha o parcelamento"
        return original_responder(callback_query_id, texto)

    def editar_mensagem_com_boletos(message, texto):
        if texto == "Pedido aprovado":
            uuid = _extrair_uuid_mensagem(message)
            if uuid and uuid in LAST_PENDING_PARCELAMENTO:
                return _editar_mensagem_escolha_parcelas(message, uuid)
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

    def _editar_mensagem_escolha_parcelas(message, uuid):
        config = module.load_telegram_env()
        token = config.get("TELEGRAM_TOKEN")
        if not token or not message:
            return original_editar(message, "Escolha o parcelamento")

        chat = message.get("chat") or {}
        chat_id = chat.get("id")
        message_id = message.get("message_id")
        if not chat_id or not message_id:
            return original_editar(message, "Escolha o parcelamento")

        texto_base = (message.get("text") or "").strip()
        texto = f"{texto_base}\n\nEscolha em quantas parcelas deseja gerar no Asaas:"
        if "UUID:" not in texto:
            texto = f"{texto}\n\nUUID: {uuid}"

        botoes = []
        linha = []
        for parcela in range(1, _max_parcelas_telegram() + 1):
            linha.append({"text": f"{parcela}x", "callback_data": f"parcelar_orcamento:{uuid}:{parcela}"})
            if len(linha) == 3:
                botoes.append(linha)
                linha = []
        if linha:
            botoes.append(linha)

        requests.post(
            module._telegram_api_url(token, "editMessageText"),
            json={
                "chat_id": chat_id,
                "message_id": message_id,
                "text": texto,
                "reply_markup": {"inline_keyboard": botoes},
            },
            timeout=10,
        )
        return None

    module._validar_callback_orcamento = validar_callback_com_parcelamento
    module._aprovar_orcamento_por_telegram = aprovar_com_asaas
    module._responder_callback_telegram = responder_callback_com_parcelamento
    module._editar_mensagem_telegram = editar_mensagem_com_boletos
    _registrar_endpoint_boletos(module)
    INSTALADO = True
    print("[ASAAS] Integração de boletos com parcelamento instalada no fluxo de aprovação Telegram.")
