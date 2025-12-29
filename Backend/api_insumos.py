import os
import requests
from flask import Blueprint, request, jsonify

# =====================
# CONFIG SUPABASE (AQUI MESMO)
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

insumos_bp = Blueprint("insumos_bp", __name__)

# =====================
# ROTAS INSUMOS
# =====================

@insumos_bp.route("/api/materiais", methods=["GET"])
def listar_materiais():
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/materiais?select=*&order=nome.asc",
            headers=HEADERS
        )
        r.raise_for_status()
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@insumos_bp.route("/api/materiais", methods=["POST"])
def criar_material():
    try:
        data = request.json or {}

        preco = float(data.get("preco", 0))

        payload = {
            "nome": data["nome"],
            "custo": data["custo"],
            "tipo_medida": data["tipo_medida"],
            "margem": data["margem"],
            "perda": data["perda"],
            "preco": round(preco, 2)
        }

        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/materiais",
            headers=HEADERS,
            json=payload
        )
        r.raise_for_status()

        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@insumos_bp.route("/api/materiais/<id>", methods=["PUT"])
def editar_material(id):
    try:
        data = request.json or {}
        preco = float(data.get("preco", 0))

        payload = {
            "nome": data["nome"],
            "custo": data["custo"],
            "tipo_medida": data["tipo_medida"],
            "margem": data["margem"],
            "perda": data["perda"],
            "preco": round(preco, 2)
        }

        r = requests.patch(
            f"{SUPABASE_URL}/rest/v1/materiais?id=eq.{id}",
            headers=HEADERS,
            json=payload
        )
        r.raise_for_status()

        return jsonify({"status": "updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@insumos_bp.route("/api/materiais/<id>", methods=["DELETE"])
def deletar_material(id):
    try:
        r = requests.delete(
            f"{SUPABASE_URL}/rest/v1/materiais?id=eq.{id}",
            headers=HEADERS
        )
        r.raise_for_status()

        return jsonify({"status": "deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
