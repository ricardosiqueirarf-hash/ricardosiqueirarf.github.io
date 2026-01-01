from flask import Blueprint, request, jsonify
import requests

estruturas3d_bp = Blueprint("estruturas3d_bp", __name__)


@estruturas3d_bp.route("/api/estruturas", methods=["POST"])
def salvar_estrutura_3d():
    from app import SUPABASE_URL, HEADERS, SUPABASE_TABLE_ESTRUTURAS3D

    data = request.json or {}
    payload = {
        "orcamento_uuid": data.get("orcamento_uuid"),
        "material": data.get("material"),
        "imagem": data.get("imagem"),
        "custototal": data.get("custototal"),
        "precototal": data.get("precototal"),
        "comprimentotot": data.get("comprimentotot"),
        "fixadores": data.get("fixadores"),
    }

    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE_ESTRUTURAS3D}",
        headers=HEADERS,
        json=payload,
    )
    r.raise_for_status()
    return jsonify({"success": True, "data": r.json()})

