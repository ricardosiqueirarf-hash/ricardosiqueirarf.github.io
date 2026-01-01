from flask import Blueprint, request, jsonify, make_response
import requests

estruturas3d_bp = Blueprint("estruturas3d_bp", __name__)


@estruturas3d_bp.route("/api/estruturas", methods=["POST", "OPTIONS"])
def salvar_estrutura_3d():
    if request.method == "OPTIONS":
        return make_response("", 204)

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


