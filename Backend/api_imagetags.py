import os
import requests
from flask import Blueprint, jsonify, request
from flask_cors import CORS

# =====================
# CONFIG
# =====================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL e SUPABASE_KEY não definidos")

imagetags_bp = Blueprint("imagetags_bp", __name__)
CORS(imagetags_bp, resources={r"/api/*": {"origins": "*"}})

HEADERS_JSON = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

TABLE = "imagetags"


def _is_json_primitive(x):
    return x is None or isinstance(x, (str, int, float, bool, dict, list))


@imagetags_bp.route("/api/imagetags/upsert", methods=["POST"])
def upsert_imagetags():
    """
    Body JSON esperado:
    {
      "id": "comprovantes/<userId>/<arquivo>.jpg"  (ou o path que você quiser)
      "tais": { ... qualquer JSONB ... }
    }
    """
    try:
        payload = request.get_json(force=True, silent=False) or {}
    except Exception:
        return jsonify({"error": "JSON inválido"}), 400

    img_id = (payload.get("id") or "").strip()
    tais = payload.get("tais")

    if not img_id:
        return jsonify({"error": "Campo 'id' é obrigatório (text)"}), 400
    if not _is_json_primitive(tais):
        return jsonify({"error": "Campo 'tais' deve ser JSON (dict/list/string/number/bool/null)"}), 400

    # UPSERT via PostgREST:
    # - POST em /rest/v1/imagetags
    # - Prefer: resolution=merge-duplicates
    # - on_conflict=id
    headers = {**HEADERS_JSON, "Prefer": "resolution=merge-duplicates,return=representation"}

    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/{TABLE}?on_conflict=id",
            headers=headers,
            json={"id": img_id, "tais": tais},
            timeout=20,
        )

        if not r.ok:
            return jsonify({"error": r.text, "status": r.status_code}), r.status_code

        data = r.json()
        # PostgREST retorna lista quando return=representation
        row = data[0] if isinstance(data, list) and data else data
        return jsonify({"status": "ok", "row": row}), 200

    except requests.RequestException as exc:
        return jsonify({"error": f"Falha na requisição: {str(exc)}"}), 500


@imagetags_bp.route("/api/imagetags/get", methods=["GET"])
def get_imagetags():
    img_id = (request.args.get("id") or "").strip()
    if not img_id:
        return jsonify({"error": "Query param 'id' é obrigatório"}), 400

    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/{TABLE}?id=eq.{img_id}&select=id,tais&limit=1",
            headers=HEADERS_JSON,
            timeout=20,
        )
        if not r.ok:
            return jsonify({"error": r.text, "status": r.status_code}), r.status_code

        rows = r.json() or []
        if not rows:
            return jsonify({"status": "not_found"}), 404

        return jsonify({"status": "ok", "row": rows[0]}), 200

    except requests.RequestException as exc:
        return jsonify({"error": f"Falha na requisição: {str(exc)}"}), 500


@imagetags_bp.route("/api/imagetags/list", methods=["GET"])
def list_imagetags():
    """
    Opcional: lista registros.
    Você pode filtrar por prefixo do id (ex: userId/ ou bucket/userId/)
    /api/imagetags/list?prefix=3e5e...&limit=50
    """
    prefix = (request.args.get("prefix") or "").strip()
    try:
        limit = int(request.args.get("limit") or "50")
        limit = max(1, min(limit, 200))
    except Exception:
        limit = 50

    try:
        # ilike prefix%
        if prefix:
            url = f"{SUPABASE_URL}/rest/v1/{TABLE}?id=ilike.{prefix}%25&select=id,tais&limit={limit}"
        else:
            url = f"{SUPABASE_URL}/rest/v1/{TABLE}?select=id,tais&limit={limit}"

        r = requests.get(url, headers=HEADERS_JSON, timeout=20)
        if not r.ok:
            return jsonify({"error": r.text, "status": r.status_code}), r.status_code

        return jsonify({"status": "ok", "rows": r.json() or []}), 200

    except requests.RequestException as exc:
        return jsonify({"error": f"Falha na requisição: {str(exc)}"}), 500
