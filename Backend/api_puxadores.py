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

puxadores_bp = Blueprint("puxadores_bp", __name__)

# =====================
# ROTAS INSUMOS
# =====================

@puxadores_bp.route("/api/puxadores", methods=["GET"])
def listar_puxadores():
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/puxadores?select=*&order=nome.asc",
            headers=HEADERS
        )
        r.raise_for_status()
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@puxadores_bp.route("/api/puxadores", methods=["POST"])
def criar_puxadores():
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
            f"{SUPABASE_URL}/rest/v1/puxadores",
            headers=HEADERS,
            json=payload
        )
        r.raise_for_status()

        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@puxadores_bp.route("/api/puxadores/<id>", methods=["PUT"])
def editar_puxadores(id):
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
            f"{SUPABASE_URL}/rest/v1/puxadores?id=eq.{id}",
            headers=HEADERS,
            json=payload
        )
        r.raise_for_status()

        return jsonify({"status": "updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@puxadores_bp.route("/api/puxadores/<id>", methods=["DELETE"])
def deletar_puxadores(id):
    try:
        r = requests.delete(
            f"{SUPABASE_URL}/rest/v1/puxaores?id=eq.{id}",
            headers=HEADERS
        )
        r.raise_for_status()

        return jsonify({"status": "deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
