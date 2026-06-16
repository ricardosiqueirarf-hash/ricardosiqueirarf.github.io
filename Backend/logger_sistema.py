import os
import requests

try:
    from flask import request, has_request_context
except Exception:
    request = None
    def has_request_context():
        return False


LOGS_TABLE = os.getenv("SUPABASE_TABLE_LOGS_SISTEMA", "logs_sistema")


def _supabase_config():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    return url, key


def _headers(prefer="return=minimal"):
    _, key = _supabase_config()
    return {
        "apikey": key or "",
        "Authorization": f"Bearer {key or ''}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": prefer,
    }


def _client_ip():
    if not has_request_context() or request is None:
        return "unknown"
    forwarded = request.headers.get("X-Forwarded-For") or ""
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    return request.remote_addr or "unknown"


def _user_agent():
    if not has_request_context() or request is None:
        return ""
    return request.headers.get("User-Agent") or ""


def _int_or_none(valor):
    try:
        return int(valor)
    except Exception:
        return None


def _uuid_or_none(valor):
    texto = str(valor or "").strip()
    return texto or None


def _storeid(usuario):
    usuario = usuario or {}
    return (
        usuario.get("storeid")
        or usuario.get("lojaid")
        or usuario.get("storeID")
        or usuario.get("lojaID")
    )


def nome_usuario(usuario):
    usuario = usuario or {}
    dados = usuario.get("dados") if isinstance(usuario.get("dados"), dict) else {}
    return str(
        dados.get("nome")
        or dados.get("NOME")
        or usuario.get("nome")
        or usuario.get("NOME")
        or usuario.get("user")
        or usuario.get("userid")
        or "-"
    ).strip()


def _json_obj(valor):
    if isinstance(valor, dict):
        return valor
    if valor is None:
        return {}
    return {"valor": valor}


def money_br(valor):
    try:
        numero = float(valor or 0)
    except (TypeError, ValueError):
        numero = 0.0
    texto = f"{numero:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {texto}"


def enviar_telegram(texto):
    try:
        import api_orcamentos as tg
        cfg = tg.load_telegram_env()
        bot_token = cfg.get("TELEGRAM_" + "TOKEN")
        chat_id = cfg.get("TELEGRAM_" + "CHAT_ID")
        if not bot_token or not chat_id:
            raise RuntimeError("Bot Telegram não configurado.")
        url = tg._telegram_api_url(bot_token, "send" + "Message")
        r = requests.post(url, json={"chat_id": chat_id, "text": texto}, timeout=15)
        r.raise_for_status()
        payload = r.json()
        if not payload.get("ok"):
            raise RuntimeError(payload.get("description") or "Telegram recusou a mensagem.")
        return True
    except Exception as exc:
        print(f"[LOGGER_SISTEMA] Falha ao enviar Telegram: {exc}")
        return False


def registrar_log(
    *,
    categoria,
    acao,
    usuario=None,
    severidade="info",
    origem=None,
    entidade_tipo=None,
    entidade_id=None,
    numero_pedido=None,
    valor_anterior=None,
    valor_novo=None,
    resumo=None,
    metadata=None,
    enviar_telegram_msg=None,
):
    url, key = _supabase_config()
    if not url or not key:
        print("[LOGGER_SISTEMA] Supabase não configurado; log ignorado.")
        return False

    usuario = usuario or {}
    metadata = metadata if isinstance(metadata, dict) else {}

    payload = {
        "usuario_id": _uuid_or_none(usuario.get("userid")),
        "usuario_nome": nome_usuario(usuario),
        "usuario_user": usuario.get("user"),
        "usuario_level": _int_or_none(usuario.get("level")),
        "storeid": _storeid(usuario),
        "categoria": str(categoria),
        "acao": str(acao),
        "severidade": str(severidade or "info"),
        "origem": origem,
        "ip": _client_ip(),
        "user_agent": _user_agent(),
        "entidade_tipo": entidade_tipo,
        "entidade_id": _uuid_or_none(entidade_id),
        "numero_pedido": _int_or_none(numero_pedido),
        "valor_anterior": _json_obj(valor_anterior),
        "valor_novo": _json_obj(valor_novo),
        "resumo": resumo,
        "metadata": metadata,
    }

    ok_banco = False
    try:
        r = requests.post(
            f"{url}/rest/v1/{LOGS_TABLE}",
            headers=_headers(),
            json=payload,
            timeout=10,
        )
        r.raise_for_status()
        ok_banco = True
    except Exception as exc:
        print(f"[LOGGER_SISTEMA] Falha ao registrar {categoria}.{acao}: {exc}")

    if enviar_telegram_msg:
        enviar_telegram(str(enviar_telegram_msg))

    return ok_banco


def log_orcamento_criado(usuario, orcamento, enviar_telegram_alerta=True):
    orcamento = orcamento or {}
    numero = orcamento.get("numero_pedido")
    cliente = orcamento.get("cliente_nome") or "-"
    loja = orcamento.get("lojaid") or orcamento.get("storeID") or "-"
    uuid = orcamento.get("id") or orcamento.get("uuid")
    resumo = f"Orçamento {numero or uuid} criado para {cliente}"
    telegram = None
    if enviar_telegram_alerta:
        telegram = (
            "LOG ORÇAMENTO - NOVA FICHA CRIADA\n\n"
            f"Pedido: {numero or '-'}\n"
            f"Cliente: {cliente}\n"
            f"Loja: {loja}\n"
            f"Usuário: {nome_usuario(usuario)}\n"
            f"UUID: {uuid or '-'}"
        )
    return registrar_log(
        categoria="orcamento",
        acao="orcamento_criado",
        usuario=usuario,
        severidade="info",
        origem="api_orcamento",
        entidade_tipo="orcamento",
        entidade_id=uuid,
        numero_pedido=numero,
        valor_anterior={},
        valor_novo={
            "id": uuid,
            "numero_pedido": numero,
            "cliente_nome": cliente,
            "lojaid": loja,
            "status": orcamento.get("status"),
            "valor_total": orcamento.get("valor_total"),
            "quantidade_total": orcamento.get("quantidade_total"),
        },
        resumo=resumo,
        metadata={"cliente_nome": cliente, "lojaid": loja},
        enviar_telegram_msg=telegram,
    )


def log_orcamento_alterado(usuario, antes, depois, acao="orcamento_alterado", resumo=None, enviar_telegram_alerta=False):
    antes = antes or {}
    depois = depois or {}
    uuid = depois.get("id") or antes.get("id")
    numero = depois.get("numero_pedido") or antes.get("numero_pedido")
    cliente = depois.get("cliente_nome") or antes.get("cliente_nome") or "-"
    resumo = resumo or f"Orçamento {numero or uuid} alterado"
    telegram = None
    if enviar_telegram_alerta:
        telegram = (
            "LOG ORÇAMENTO - FICHA ALTERADA\n\n"
            f"Pedido: {numero or '-'}\n"
            f"Cliente: {cliente}\n"
            f"Usuário: {nome_usuario(usuario)}\n"
            f"UUID: {uuid or '-'}"
        )
    return registrar_log(
        categoria="orcamento",
        acao=acao,
        usuario=usuario,
        severidade="info",
        origem="api_orcamento",
        entidade_tipo="orcamento",
        entidade_id=uuid,
        numero_pedido=numero,
        valor_anterior=antes,
        valor_novo=depois,
        resumo=resumo,
        metadata={"cliente_nome": cliente},
        enviar_telegram_msg=telegram,
    )


def log_portas_alteradas(usuario, orcamento, anterior, novo, enviar_telegram_alerta=True):
    orcamento = orcamento or {}
    anterior = anterior or {}
    novo = novo or {}
    uuid = orcamento.get("id")
    numero = orcamento.get("numero_pedido")
    cliente = orcamento.get("cliente_nome") or "-"
    telegram = None
    if enviar_telegram_alerta:
        telegram = (
            "LOG PORTAS - PORTAS CRIADAS/ALTERADAS\n\n"
            f"Pedido: {numero or '-'}\n"
            f"Cliente: {cliente}\n"
            f"Modelos antes: {anterior.get('qtd_modelos') or 0}\n"
            f"Modelos agora: {novo.get('qtd_modelos') or 0}\n"
            f"Qtd antes: {anterior.get('quantidade_total') or 0}\n"
            f"Qtd agora: {novo.get('quantidade_total') or 0}\n"
            f"Valor antes: {money_br(anterior.get('valor_total'))}\n"
            f"Valor agora: {money_br(novo.get('valor_total'))}\n"
            f"Usuário: {nome_usuario(usuario)}\n"
            f"UUID: {uuid or '-'}"
        )
    return registrar_log(
        categoria="orcamento",
        acao="portas_alteradas",
        usuario=usuario,
        severidade="info",
        origem="api_portas",
        entidade_tipo="orcamento",
        entidade_id=uuid,
        numero_pedido=numero,
        valor_anterior=anterior,
        valor_novo=novo,
        resumo=f"Portas do orçamento {numero or uuid} foram alteradas",
        metadata={"cliente_nome": cliente, "lojaid": orcamento.get("lojaid"), "status": orcamento.get("status")},
        enviar_telegram_msg=telegram,
    )


def log_financeiro_valor_pago(usuario, orcamento, anterior, novo, enviar_telegram_alerta=True):
    orcamento = orcamento or {}
    uuid = orcamento.get("id")
    numero = orcamento.get("numero_pedido")
    cliente = orcamento.get("cliente_nome") or "-"
    telegram = None
    if enviar_telegram_alerta:
        telegram = (
            "LOG CONTROLE - VALOR PAGO ALTERADO\n\n"
            f"Pedido: {numero or '-'}\n"
            f"Cliente: {cliente}\n"
            f"Valor pago: {money_br(anterior)} -> {money_br(novo)}\n\n"
            f"Usuário: {nome_usuario(usuario)}\n"
            f"UUID: {uuid or '-'}"
        )
    return registrar_log(
        categoria="financeiro",
        acao="valor_pago_alterado",
        usuario=usuario,
        severidade="alerta",
        origem="api_financeiro",
        entidade_tipo="orcamento",
        entidade_id=uuid,
        numero_pedido=numero,
        valor_anterior={"valor_pago": anterior},
        valor_novo={"valor_pago": novo},
        resumo=f"Valor pago do pedido {numero or uuid} alterado de {money_br(anterior)} para {money_br(novo)}",
        metadata={"cliente_nome": cliente, "lojaid": orcamento.get("lojaid"), "valor_total": orcamento.get("valor_total")},
        enviar_telegram_msg=telegram,
    )


def log_login_autorizado(usuario, data_acesso=None, hora_acesso=None, enviar_telegram_alerta=True):
    usuario = usuario or {}
    level = usuario.get("level")
    loja = _storeid(usuario) or "-"
    telegram = None
    if enviar_telegram_alerta:
        telegram = (
            "LOG LOGIN - ACESSO AUTORIZADO\n\n"
            f"Nome: {nome_usuario(usuario)}\n"
            f"Nível: {level or '-'}\n"
            f"Loja/StoreID: {loja}\n"
            f"Data: {data_acesso or '-'}\n"
            f"Horário: {hora_acesso or '-'}\n"
            f"IP: {_client_ip()}"
        )
    return registrar_log(
        categoria="login",
        acao="acesso_autorizado",
        usuario=usuario,
        severidade="info",
        origem="api_login",
        resumo=f"{nome_usuario(usuario)} acessou o sistema",
        metadata={"data_acesso": data_acesso, "hora_acesso": hora_acesso},
        enviar_telegram_msg=telegram,
    )
