import os
import requests
from flask import Blueprint, request, jsonify

# =====================
# CONFIG SUPABASE (LOCAL)
# =====================

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL ou SUPABASE_KEY não configurados")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

# =====================
# BLUEPRINT
# =====================

tags_bp = Blueprint("tags_bp", __name__)

# =====================
# ROTAS TAGS
# =====================

@tags_bp.route("/api/tags", methods=["GET"])
def listar_tags():
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/tags?select=*&order=id.asc",
            headers=HEADERS
        )
        r.raise_for_status()
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tags_bp.route("/api/tags", methods=["POST"])
def criar_tag():
    try:
        data = request.json or {}
        payload = {
            "tags": data.get("tags", []),
            "perfis": data.get("perfis"),
            "vidros": data.get("vidros"),
            "valor": data.get("valor"),
            "medida": data.get("medida")
        }

        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/tags",
            headers=HEADERS,
            json=payload
        )
        r.raise_for_status()
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tags_bp.route("/api/tags/<id>", methods=["PUT"])
def editar_tag(id):
    try:
        data = request.json or {}
        payload = {
            "tags": data.get("tags", []),
            "perfis": data.get("perfis"),
            "vidros": data.get("vidros"),
            "valor": data.get("valor"),
            "medida": data.get("medida")
        }

        r = requests.patch(
            f"{SUPABASE_URL}/rest/v1/tags?id=eq.{id}",
            headers=HEADERS,
            json=payload
        )
        r.raise_for_status()
        return jsonify({"status": "updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tags_bp.route("/api/tags/<id>", methods=["DELETE"])
def deletar_tag(id):
    try:
        r = requests.delete(
            f"{SUPABASE_URL}/rest/v1/tags?id=eq.{id}",
            headers=HEADERS
        )
        r.raise_for_status()
        return jsonify({"status": "deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
