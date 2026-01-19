from flask import Blueprint, jsonify, request
import requests

from auth_utils import buscar_usuario_por_token, extrair_token


clientes_api_bp = Blueprint("clientes_api_bp", __name__)


def _tem_permissao():
    token = extrair_token(request)
    usuario = buscar_usuario_por_token(token) if token else None
    nivel = int((usuario or {}).get("level") or 0)
    return nivel in (2, 3)


@clientes_api_bp.route("/api/clientes/storeids", methods=["GET"])
def listar_storeids():
    if not _tem_permissao():
        return jsonify({"error": "Acesso negado"}), 403

    from app import SUPABASE_URL, HEADERS

    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/usuarios?select=storeid&storeid=not.is.null",
            headers=HEADERS,
            timeout=20
        )
        r.raise_for_status()
        rows = r.json()
    except Exception as exc:
        return jsonify({
            "error": "Falha ao consultar usuários",
            "details": str(exc)
        }), 500

    store_ids = sorted({
        str(row.get("storeid")).strip()
        for row in rows
        if row.get("storeid") is not None and str(row.get("storeid")).strip()
    })

    return jsonify({"storeIds": store_ids})
