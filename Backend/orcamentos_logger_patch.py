import requests
from flask import g, request

from logger_sistema import log_orcamento_criado, log_orcamento_alterado, registrar_log, nome_usuario


STATUS_LABELS = {
    0: "Cancelado",
    1: "Orçamento",
    2: "Aprovado",
    3: "Em Produção",
    4: "Separado",
    5: "Entregue",
}


def _status_label(valor):
    try:
        v = int(valor)
    except (TypeError, ValueError):
        return str(valor or "-")
    return STATUS_LABELS.get(v, str(v))


def _usuario_request(module):
    token = module.extrair_token(request)
    if not token:
        return {}
    try:
        return module.buscar_usuario_por_token(token) or {}
    except Exception:
        return {}


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


def _telegram_status(usuario, antes, depois):
    return (
        "LOG CONTROLE - STATUS ALTERADO\n\n"
        f"Pedido: {depois.get('numero_pedido') or antes.get('numero_pedido') or '-'}\n"
        f"Cliente: {depois.get('cliente_nome') or antes.get('cliente_nome') or '-'}\n"
        f"Loja: {depois.get('lojaid') or antes.get('lojaid') or '-'}\n"
        f"Valor total: {depois.get('valor_total') or antes.get('valor_total') or 0}\n"
        f"Status: {_status_label(antes.get('status'))} ({antes.get('status')}) -> {_status_label(depois.get('status'))} ({depois.get('status')})\n\n"
        f"Usuário: {nome_usuario(usuario)}\n"
        f"UUID: {depois.get('id') or antes.get('id') or '-'}"
    )


def install(module):
    bp = getattr(module, "orcamentos_bp", None)
    if not bp or getattr(bp, "_orcamentos_logger_patch_installed", False):
        return
    bp._orcamentos_logger_patch_installed = True

    @bp.before_request
    def _logger_capturar_antes():
        path = request.path or ""
        method = request.method
        g.logger_orcamento_antes = None
        g.logger_usuario = _usuario_request(module)

        if method in {"PATCH", "POST"} and path.startswith("/api/orcamento/"):
            partes = path.strip("/").split("/")
            uuid = partes[2] if len(partes) >= 3 else None
            if uuid:
                try:
                    g.logger_orcamento_antes = _buscar_orcamento(uuid)
                except Exception as exc:
                    print(f"[ORCAMENTOS_LOGGER] Falha ao buscar antes {uuid}: {exc}")

    @bp.after_request
    def _logger_registrar_depois(response):
        try:
            if response.status_code < 200 or response.status_code >= 300:
                return response

            path = request.path or ""
            method = request.method
            body = request.get_json(silent=True) or {}
            resp = response.get_json(silent=True) or {}
            usuario = getattr(g, "logger_usuario", {}) or _usuario_request(module)

            if method == "POST" and path == "/api/orcamento" and resp.get("success"):
                entidade_id = resp.get("id") or resp.get("uuid")
                orcamento = {
                    "id": entidade_id,
                    "uuid": entidade_id,
                    "numero_pedido": resp.get("numero_pedido"),
                    "cliente_nome": resp.get("cliente_nome") or body.get("cliente_nome") or "-",
                    "lojaid": body.get("storeID") or body.get("lojaid") or body.get("lojaID"),
                    "status": resp.get("status"),
                    "valor_total": 0,
                    "quantidade_total": 0,
                }
                log_orcamento_criado(usuario, orcamento, enviar_telegram_alerta=True)
                return response

            if method == "PATCH" and path.endswith("/cliente") and "/api/orcamento/" in path and resp.get("success"):
                antes = getattr(g, "logger_orcamento_antes", None) or {}
                depois = {
                    "id": resp.get("id") or antes.get("id"),
                    "numero_pedido": antes.get("numero_pedido"),
                    "cliente_nome": resp.get("cliente_nome"),
                    "lojaid": resp.get("lojaid"),
                    "status": resp.get("status"),
                }
                log_orcamento_alterado(
                    usuario,
                    {
                        "id": antes.get("id"),
                        "numero_pedido": antes.get("numero_pedido"),
                        "cliente_nome": antes.get("cliente_nome"),
                        "lojaid": antes.get("lojaid"),
                        "status": antes.get("status"),
                    },
                    depois,
                    acao="cliente_loja_alterado",
                    resumo=f"Orçamento {antes.get('numero_pedido') or antes.get('id')} teve cliente/loja alterado",
                    enviar_telegram_alerta=True,
                )
                return response

            if method == "POST" and path.endswith("/status") and "/api/orcamento/" in path and resp.get("success"):
                antes = getattr(g, "logger_orcamento_antes", None) or {}
                partes = path.strip("/").split("/")
                entidade_id = partes[2] if len(partes) >= 3 else antes.get("id")
                depois = _buscar_orcamento(entidade_id) or {
                    "id": entidade_id,
                    "numero_pedido": antes.get("numero_pedido"),
                    "cliente_nome": antes.get("cliente_nome"),
                    "lojaid": antes.get("lojaid"),
                    "valor_total": antes.get("valor_total"),
                    "status": resp.get("status"),
                }
                registrar_log(
                    categoria="orcamento",
                    acao="status_alterado",
                    usuario=usuario,
                    severidade="info",
                    origem="api_orcamento_status",
                    entidade_tipo="orcamento",
                    entidade_id=entidade_id,
                    numero_pedido=depois.get("numero_pedido") or antes.get("numero_pedido"),
                    valor_anterior={"status": antes.get("status"), "label": _status_label(antes.get("status"))},
                    valor_novo={"status": depois.get("status"), "label": _status_label(depois.get("status"))},
                    resumo=f"Pedido {depois.get('numero_pedido') or antes.get('numero_pedido') or entidade_id} alterado de {_status_label(antes.get('status'))} para {_status_label(depois.get('status'))}",
                    metadata={
                        "cliente_nome": depois.get("cliente_nome") or antes.get("cliente_nome"),
                        "lojaid": depois.get("lojaid") or antes.get("lojaid"),
                        "valor_total": depois.get("valor_total") or antes.get("valor_total"),
                    },
                    enviar_telegram_msg=_telegram_status(usuario, antes, depois),
                )
                return response

            if method == "POST" and path.endswith("/finalizar") and "/api/orcamento/" in path and resp.get("success"):
                antes = getattr(g, "logger_orcamento_antes", None) or {}
                partes = path.strip("/").split("/")
                entidade_id = partes[2] if len(partes) >= 3 else antes.get("id")
                depois = {
                    "id": entidade_id,
                    "numero_pedido": antes.get("numero_pedido"),
                    "cliente_nome": antes.get("cliente_nome"),
                    "quantidade_total": resp.get("quantidade_total"),
                    "valor_total": resp.get("valor_total"),
                }
                log_orcamento_alterado(
                    usuario,
                    {
                        "id": antes.get("id"),
                        "numero_pedido": antes.get("numero_pedido"),
                        "cliente_nome": antes.get("cliente_nome"),
                        "quantidade_total": antes.get("quantidade_total"),
                        "valor_total": antes.get("valor_total"),
                    },
                    depois,
                    acao="totais_alterados",
                    resumo=f"Orçamento {antes.get('numero_pedido') or entidade_id} teve totais alterados",
                    enviar_telegram_alerta=True,
                )
                return response

        except Exception as exc:
            print(f"[ORCAMENTOS_LOGGER] Erro no after_request: {exc}")
        return response

    print("[ORCAMENTOS_LOGGER] Patch centralizado instalado")
