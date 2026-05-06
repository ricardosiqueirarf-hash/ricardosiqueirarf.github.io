from flask import Blueprint, jsonify, request
import requests

from auth_utils import buscar_usuario_por_token, extrair_token


clientes_api_bp = Blueprint("clientes_api_bp", __name__)


def _tem_permissao():
    token = extrair_token(request)
    usuario = buscar_usuario_por_token(token) if token else None
    nivel = int((usuario or {}).get("level") or 0)
    return nivel in (2, 3)


def _valor_texto(*valores):
    for valor in valores:
        texto = str(valor or "").strip()
        if texto:
            return texto
    return ""


def _nome_loja(row, storeid):
    return _valor_texto(row.get("nome"), storeid)


@clientes_api_bp.route("/api/clientes/storeids", methods=["GET"])
def listar_storeids():
    if not _tem_permissao():
        return jsonify({"error": "Acesso negado"}), 403

    from app import SUPABASE_URL, HEADERS

    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/usuarios",
            headers=HEADERS,
            params={"select": "*"},
            timeout=20
        )
        r.raise_for_status()
        rows = r.json() or []
    except Exception as exc:
        return jsonify({
            "error": "Falha ao consultar usuários",
            "details": str(exc)
        }), 500

    lojas_por_storeid = {}
    for row in rows:
        storeid = _valor_texto(
            row.get("storeid"),
            row.get("storeID"),
            row.get("lojaid"),
            row.get("lojaID")
        )
        if not storeid:
            continue

        lojas_por_storeid[storeid] = {
            "storeID": storeid,
            "nome": _nome_loja(row, storeid)
        }

    lojas = sorted(
        lojas_por_storeid.values(),
        key=lambda loja: loja["nome"].casefold()
    )
    store_ids = [loja["storeID"] for loja in lojas]

    return jsonify({"storeIds": store_ids, "stores": lojas})
