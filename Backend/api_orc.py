# api_orc.py
from flask import Blueprint, request, jsonify
import requests

orc_bp = Blueprint("orc_bp", __name__)

@orc_bp.route("/api/orcamento/<uuid:orcamento_uuid>/finalizar", methods=["POST"])
def finalizar_orcamento(orcamento_uuid):
    """
    Atualiza um orçamento existente com quantidade total e valor total
    """
    from app import SUPABASE_URL, HEADERS  # pegue as variáveis do app principal

    data = request.json
    quantidade_total = data.get("quantidade_total")
    valor_total = data.get("valor_total")

    if quantidade_total is None or valor_total is None:
        return jsonify({"success": False, "error": "Dados incompletos"}), 400

    try:
        # Atualiza o orçamento no Supabase
        r = requests.patch(
            f"{SUPABASE_URL}/rest/v1/orcamentos?id=eq.{orcamento_uuid}",
            headers={**HEADERS, "Content-Type": "application/json"},
            json={
                "quantidade_total": quantidade_total,
                "valor_total": valor_total
            }
        )
        r.raise_for_status()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
