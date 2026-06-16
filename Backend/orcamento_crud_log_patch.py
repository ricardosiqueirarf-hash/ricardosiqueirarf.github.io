import os
import requests
from flask import g, request

LOGS_TABLE = os.getenv("SUPABASE_TABLE_LOGS_SISTEMA", "logs_sistema")


def _headers():
    from app import SUPABASE_SERVICE_ROLE_KEY
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "return=minimal",
    }


def _client_ip():
    forwarded = request.headers.get("X-Forwarded-For") or ""
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    return request.remote_addr or "unknown"


def _int_or_none(valor):
    try:
        return int(valor)
    except Exception:
        return None


def _usuario_request(module):
    token = module.extrair_token(request)
    if not token:
        return {}
    try:
        return module.buscar_usuario_por_token(token) or {}
    except Exception:
        return {}


def _nome_usuario(usuario):
    usuario = usuario or {}
    dados = usuario.get("dados") if isinstance(usuario.get("dados"), dict) else {}
    return dados.get("nome") or usuario.get("nome") or usuario.get("user") or usuario.get("userid") or "-"


def _storeid(usuario):
    usuario = usuario or {}
    return usuario.get("storeid") or usuario.get("lojaid") or usuario.get("storeID") or usuario.get("lojaID")


def _money_br(valor):
    try:
        numero = float(valor or 0)
    except (TypeError, ValueError):
        numero = 0.0
    texto = f"{numero:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {texto}"


def _telegram_send(module, texto):
    try:
        cfg = module.load_telegram_env()
        bot_token = cfg.get("TELEGRAM_" + "TOKEN")
        chat_id = cfg.get("TELEGRAM_" + "CHAT_ID")
        if not bot_token or not chat_id:
            raise RuntimeError("Bot Telegram não configurado.")
        url = module._telegram_api_url(bot_token, "send" + "Message")
        r = requests.post(url, json={"chat_id": chat_id, "text": texto}, timeout=15)
        r.raise_for_status()
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(data.get("description") or "Telegram recusou a mensagem.")
    except Exception as exc:
        print(f"[ORCAMENTO_LOG] Falha ao enviar Telegram: {exc}")


def _buscar_orcamento(uuid):
    from app import SUPABASE_URL, HEADERS
    if not uuid:
        return None
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/orcamentos",
        headers=HEADERS,
        params={
            "select": "id,numero_pedido,cliente_nome,lojaid,status,valor_total,valor_pago,quantidade_total",
            "id": f"eq.{uuid}",
            "limit": "1",
        },
        timeout=10,
    )
    r.raise_for_status()
    rows = r.json() or []
    return rows[0] if rows else None


def _registrar(usuario, categoria, acao, resumo, entidade_id=None, numero_pedido=None, anterior=None, novo=None, metadata=None, severidade="info"):
    from app import SUPABASE_URL
    usuario = usuario or {}
    metadata = metadata if isinstance(metadata, dict) else {}
    payload = {
        "usuario_id": usuario.get("userid"),
        "usuario_nome": _nome_usuario(usuario),
        "usuario_user": usuario.get("user"),
        "usuario_level": _int_or_none(usuario.get("level")),
        "storeid": _storeid(usuario),
        "categoria": categoria,
        "acao": acao,
        "severidade": severidade,
        "origem": metadata.get("origem") or "api_orcamentos",
        "ip": _client_ip(),
        "user_agent": request.headers.get("User-Agent") or "",
        "entidade_tipo": "orcamento",
        "entidade_id": entidade_id,
        "numero_pedido": _int_or_none(numero_pedido),
        "valor_anterior": anterior if isinstance(anterior, dict) else {},
        "valor_novo": novo if isinstance(novo, dict) else {},
        "resumo": resumo,
        "metadata": metadata,
    }
    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/{LOGS_TABLE}",
            headers=_headers(),
            json=payload,
            timeout=10,
        )
        r.raise_for_status()
    except Exception as exc:
        print(f"[ORCAMENTO_LOG] Falha ao registrar {acao}: {exc}")


def install(module):
    bp = getattr(module, "orcamentos_bp", None)
    if not bp or getattr(bp, "_orcamento_crud_log_installed", False):
        return
    bp._orcamento_crud_log_installed = True

    @bp.before_request
    def _capturar_orcamento_antes():
        path = request.path or ""
        method = request.method
        g.orcamento_log_antes = None
        g.orcamento_log_usuario = _usuario_request(module)

        if method in {"PATCH", "POST"} and path.startswith("/api/orcamento/"):
            partes = path.strip("/").split("/")
            uuid = partes[2] if len(partes) >= 3 else None
            if uuid:
                try:
                    g.orcamento_log_antes = _buscar_orcamento(uuid)
                except Exception as exc:
                    print(f"[ORCAMENTO_LOG] Falha ao capturar antes {uuid}: {exc}")

    @bp.after_request
    def _registrar_log_orcamento(response):
        try:
            if response.status_code < 200 or response.status_code >= 300:
                return response

            path = request.path or ""
            method = request.method
            usuario = getattr(g, "orcamento_log_usuario", {}) or _usuario_request(module)
            body = request.get_json(silent=True) or {}
            resp = response.get_json(silent=True) or {}
            usuario_nome = _nome_usuario(usuario)

            if method == "POST" and path == "/api/orcamento" and resp.get("success"):
                entidade_id = resp.get("id") or resp.get("uuid")
                numero = resp.get("numero_pedido")
                cliente = resp.get("cliente_nome") or body.get("cliente_nome") or "-"
                novo = {
                    "cliente_nome": cliente,
                    "status": resp.get("status"),
                    "status_label": resp.get("status_label"),
                    "numero_pedido": numero,
                }
                resumo = f"Orçamento {numero} criado para {cliente}"
                _registrar(
                    usuario,
                    "orcamento",
                    "orcamento_criado",
                    resumo,
                    entidade_id=entidade_id,
                    numero_pedido=numero,
                    anterior={},
                    novo=novo,
                    metadata={"origem": "api_orcamento_create"},
                )
                _telegram_send(module, (
                    "LOG ORÇAMENTO - NOVA FICHA CRIADA\n\n"
                    f"Pedido: {numero}\n"
                    f"Cliente: {cliente}\n"
                    f"Status: {resp.get('status_label') or resp.get('status')}\n"
                    f"Usuário: {usuario_nome}\n"
                    f"UUID: {entidade_id}"
                ))
                return response

            if method == "PATCH" and path.endswith("/cliente") and "/api/orcamento/" in path and resp.get("success"):
                antes = getattr(g, "orcamento_log_antes", None) or {}
                entidade_id = resp.get("id") or antes.get("id")
                numero = antes.get("numero_pedido")
                depois = {
                    "cliente_nome": resp.get("cliente_nome"),
                    "lojaid": resp.get("lojaid"),
                    "status": resp.get("status"),
                }
                resumo = f"Orçamento {numero or entidade_id} teve cliente/loja alterado"
                _registrar(
                    usuario,
                    "orcamento",
                    "orcamento_alterado",
                    resumo,
                    entidade_id=entidade_id,
                    numero_pedido=numero,
                    anterior={
                        "cliente_nome": antes.get("cliente_nome"),
                        "lojaid": antes.get("lojaid"),
                        "status": antes.get("status"),
                    },
                    novo=depois,
                    metadata={"origem": "api_orcamento_cliente"},
                )
                _telegram_send(module, (
                    "LOG ORÇAMENTO - FICHA ALTERADA\n\n"
                    f"Pedido: {numero or '-'}\n"
                    f"Cliente anterior: {antes.get('cliente_nome') or '-'}\n"
                    f"Cliente novo: {resp.get('cliente_nome') or '-'}\n"
                    f"Loja anterior: {antes.get('lojaid') or '-'}\n"
                    f"Loja nova: {resp.get('lojaid') or '-'}\n"
                    f"Usuário: {usuario_nome}\n"
                    f"UUID: {entidade_id}"
                ))
                return response

            if method == "POST" and path.endswith("/finalizar") and "/api/orcamento/" in path and resp.get("success"):
                antes = getattr(g, "orcamento_log_antes", None) or {}
                partes = path.strip("/").split("/")
                entidade_id = partes[2] if len(partes) >= 3 else antes.get("id")
                numero = antes.get("numero_pedido")
                novo = {
                    "quantidade_total": resp.get("quantidade_total"),
                    "valor_total": resp.get("valor_total"),
                }
                resumo = f"Orçamento {numero or entidade_id} teve totais alterados"
                _registrar(
                    usuario,
                    "orcamento",
                    "orcamento_alterado",
                    resumo,
                    entidade_id=entidade_id,
                    numero_pedido=numero,
                    anterior={
                        "quantidade_total": antes.get("quantidade_total"),
                        "valor_total": antes.get("valor_total"),
                    },
                    novo=novo,
                    metadata={"origem": "api_orcamento_finalizar", "portas_qtd": len(body.get("portas") or [])},
                )
                _telegram_send(module, (
                    "LOG ORÇAMENTO - TOTAIS ALTERADOS\n\n"
                    f"Pedido: {numero or '-'}\n"
                    f"Valor anterior: {_money_br(antes.get('valor_total'))}\n"
                    f"Valor novo: {_money_br(resp.get('valor_total'))}\n"
                    f"Qtd anterior: {antes.get('quantidade_total') or 0}\n"
                    f"Qtd nova: {resp.get('quantidade_total') or 0}\n"
                    f"Usuário: {usuario_nome}\n"
                    f"UUID: {entidade_id}"
                ))
                return response

        except Exception as exc:
            print(f"[ORCAMENTO_LOG] Erro no after_request: {exc}")
        return response

    print("[ORCAMENTO_LOG] Logs de criação/alteração de orçamento instalados")
