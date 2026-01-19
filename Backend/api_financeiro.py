import os
import requests
from flask import Blueprint, jsonify, request, make_response

api_financeiro_bp = Blueprint("api_financeiro_bp", __name__) 

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL ou SUPABASE_KEY não definidos (api_financeiro.py)")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

def _int_or_default(value, default):
    try:
        return int(value)
    except Exception:
        return default

@api_financeiro_bp.route("/api/financeiro", methods=["GET"])
def api_financeiro():
    """
    Retorna orçamentos com status aprovados (default: 2,3,4,5).

    Query params opcionais:
      - status=2,3,4,5
      - limit=500 (max 2000)
      - order=numero_pedido.asc
    """
    status_raw = (request.args.get("status") or "2,3,4,5").strip()
    status_list = [s.strip() for s in status_raw.split(",") if s.strip().isdigit()]
    if not status_list:
        status_list = ["2", "3", "4", "5"]

    limit = _int_or_default(request.args.get("limit"), 500)
    limit = max(1, min(limit, 2000))

    order = (request.args.get("order") or "numero_pedido.asc").strip()

    # IMPORTANTÍSSIMO: não pedir coluna que não existe.
    # Pelo seu erro anterior, 'data_status' não existe. Use 'data_criacao'.
    select_campos = ",".join([
        "id",
        "numero_pedido",
        "cliente_nome",
        "data_criacao",
        "status",
        "valor_total",
        "valor_pago"
    ])

    status_in = ",".join(status_list)

    supa_url = (
        f"{SUPABASE_URL}/rest/v1/orcamentos"
        f"?select={select_campos}"
        f"&status=in.({status_in})"
        f"&order={order}"
        f"&limit={limit}"
    )

    try:
        r = requests.get(supa_url, headers=HEADERS, timeout=15)
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

    # Resposta JSON direta
    return jsonify(r.json())
