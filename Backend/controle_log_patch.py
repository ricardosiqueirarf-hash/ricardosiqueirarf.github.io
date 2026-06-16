import re

import requests
from flask import g, request

INSTALADO = False


def _match_route():
    match = re.match(r"^/api/orcamento/([^/]+)/(status|valor-pago)$", request.path or "")
    if not match:
        return None, None
    return match.group(1), match.group(2)


def _buscar_orcamento(uuid):
    from app import SUPABASE_URL, HEADERS

    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/orcamentos"
        f"?select=id,numero_pedido,cliente_nome,lojaid,valor_total,valor_pago,status"
        f"&id=eq.{uuid}&limit=1",
        headers=HEADERS,
        timeout=15,
    )
    r.raise_for_status()
    itens = r.json() or []
    return itens[0] if itens else None


def _valor_float(valor):
    try:
        return float(valor or 0)
    except (TypeError, ValueError):
        return 0.0


def _post_log_interno(payload):
    auth = request.headers.get("Authorization") or ""
    headers = {"Content-Type": "application/json"}
    if auth:
        headers["Authorization"] = auth

    base = (request.url_root or "").rstrip("/")
    if not base:
        return None

    r = requests.post(
        f"{base}/api/financeiro/controle-log",
        headers=headers,
        json=payload,
        timeout=8,
    )
    r.raise_for_status()
    return r.json() if r.content else None


def install(module):
    global INSTALADO
    if INSTALADO:
        return

    bp = module.orcamentos_bp

    @bp.before_request
    def controle_log_before():
        if request.method != "POST":
            return None

        uuid, acao = _match_route()
        if not uuid or acao not in {"status", "valor-pago"}:
            return None

        try:
            g.controle_log_info = {
                "uuid": uuid,
                "acao": acao,
                "antes": _buscar_orcamento(uuid),
                "payload": request.get_json(silent=True) or {},
            }
        except Exception as exc:
            print(f"[CONTROLE_LOG] Falha ao capturar estado anterior: {exc}")
        return None

    @bp.after_request
    def controle_log_after(response):
        info = getattr(g, "controle_log_info", None)
        if not info or response.status_code >= 400:
            return response

        try:
            body = response.get_json(silent=True) or {}
            if isinstance(body, dict) and body.get("success") is False:
                return response

            antes = info.get("antes") or {}
            if not antes:
                return response

            acao = info.get("acao")
            payload_original = info.get("payload") or {}

            payload_log = {
                "uuid": info.get("uuid"),
                "numero_pedido": antes.get("numero_pedido"),
                "cliente_nome": antes.get("cliente_nome"),
                "lojaid": antes.get("lojaid"),
                "valor_total": antes.get("valor_total"),
            }

            if acao == "status":
                anterior = antes.get("status")
                novo = body.get("status") if isinstance(body, dict) else payload_original.get("status")
                if str(anterior) == str(novo):
                    return response
                payload_log.update({
                    "tipo": "status",
                    "status_anterior": anterior,
                    "status_novo": novo,
                })
            else:
                anterior = antes.get("valor_pago")
                novo = body.get("valor_pago") if isinstance(body, dict) else payload_original.get("valor_pago")
                if abs(_valor_float(anterior) - _valor_float(novo)) < 0.001:
                    return response
                payload_log.update({
                    "tipo": "valor_pago",
                    "valor_anterior": anterior,
                    "valor_novo": novo,
                })

            _post_log_interno(payload_log)
        except Exception as exc:
            print(f"[CONTROLE_LOG] Alteração salva, mas log falhou: {exc}")

        return response

    INSTALADO = True
    print("[CONTROLE_LOG] Hook instalado.")
