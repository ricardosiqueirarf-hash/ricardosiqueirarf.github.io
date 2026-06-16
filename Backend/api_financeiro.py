import os
import requests
from flask import Blueprint, jsonify, request, make_response

from auth_utils import buscar_usuario_por_token, extrair_token

api_financeiro_bp = Blueprint("api_financeiro_bp", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos (api_financeiro.py)")

HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}


def _int_or_default(value, default):
    try:
        return int(value)
    except Exception:
        return default


def _nivel_usuario(usuario):
    try:
        return int((usuario or {}).get("level") or 0)
    except (TypeError, ValueError):
        return 0


def _storeid_usuario(usuario):
    usuario = usuario or {}
    return str(
        usuario.get("storeid")
        or usuario.get("storeID")
        or usuario.get("lojaid")
        or usuario.get("lojaID")
        or ""
    ).strip()


@api_financeiro_bp.route("/api/financeiro", methods=["GET"])
def api_financeiro():
    """
    Retorna orçamentos com status aprovados.

    Regra de segurança:
      - nível 3: vê todos os orçamentos;
      - qualquer outro nível: vê somente orçamentos do próprio storeid/lojaid.
    """
    token = extrair_token(request)
    if not token:
        return make_response(jsonify({"error": "Token não informado."}), 401)

    try:
        usuario = buscar_usuario_por_token(token)
    except Exception as e:
        return make_response(jsonify({"error": str(e)}), 500)

    if not usuario:
        return make_response(jsonify({"error": "Token inválido."}), 401)

    level = _nivel_usuario(usuario)
    storeid = _storeid_usuario(usuario)

    if level != 3 and not storeid:
        return make_response(jsonify({"error": "Loja não vinculada ao usuário."}), 403)

    status_raw = (request.args.get("status") or "2,3,4,5").strip()
    status_list = [s.strip() for s in status_raw.split(",") if s.strip().isdigit()]
    if not status_list:
        status_list = ["2", "3", "4", "5"]

    limit = _int_or_default(request.args.get("limit"), 500)
    limit = max(1, min(limit, 2000))

    order = (request.args.get("order") or "numero_pedido.asc").strip()

    select_campos = ",".join([
        "id",
        "numero_pedido",
        "cliente_nome",
        "data_criacao",
        "data_aprovacao",
        "status",
        "valor_total",
        "valor_pago",
        "lojaid",
        "quantidade_total"
    ])

    params = {
        "select": select_campos,
        "status": f"in.({','.join(status_list)})",
        "order": order,
        "limit": str(limit),
    }

    if level != 3:
        params["lojaid"] = f"eq.{storeid}"

    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/orcamentos",
            headers=HEADERS,
            params=params,
            timeout=15
        )
    except Exception as e:
        return make_response(jsonify({
            "error": "Falha de rede ao consultar Supabase",
            "details": str(e)
        }), 500)

    if not r.ok:
        return make_response(jsonify({
            "error": "Supabase retornou erro",
            "status_code": r.status_code,
            "details": r.text
        }), 500)

    return jsonify(r.json())
