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

vidros_bp = Blueprint("vidros_bp", __name__)

# =====================
# CÁLCULO
# =====================

def calcular_preco(custo, margem, perda):
    custo_com_perda = custo * (1 + perda / 100)
    return custo_com_perda * (1 + margem / 100)

# =====================
# ROTAS VIDROS
# =====================

@vidros_bp.route("/api/vidros", methods=["GET"])
def listar_vidros():
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/vidros?select=*&order=tipo.asc",
            headers=HEADERS
        )
        r.raise_for_status()
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@vidros_bp.route("/api/vidros", methods=["POST"])
def criar_vidro():
    try:
        data = request.json or {}

        preco = calcular_preco(
            float(data["custo"]),
            float(data["margem"]),
            float(data["perda"])
        )

        payload = {
            "tipo": data["tipo"],
            "espessura": data["espessura"],
            "custo": data["custo"],
            "margem": data["margem"],
            "perda": data["perda"],
            "preco": round(preco, 2)
        }

        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/vidros",
            headers=HEADERS,
            json=payload
        )
        r.raise_for_status()

        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@vidros_bp.route("/api/vidros/<id>", methods=["PUT"])
def editar_vidro(id):
    try:
        data = request.json or {}

        preco = calcular_preco(
            float(data["custo"]),
            float(data["margem"]),
            float(data["perda"])
        )

        payload = {
            "tipo": data["tipo"],
            "espessura": data["espessura"],
            "custo": data["custo"],
            "margem": data["margem"],
            "perda": data["perda"],
            "preco": round(preco, 2)
        }

        r = requests.patch(
            f"{SUPABASE_URL}/rest/v1/vidros?id=eq.{id}",
            headers=HEADERS,
            json=payload
        )
        r.raise_for_status()

        return jsonify({"status": "updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@vidros_bp.route("/api/vidros/<id>", methods=["DELETE"])
def deletar_vidro(id):
    try:
        r = requests.delete(
            f"{SUPABASE_URL}/rest/v1/vidros?id=eq.{id}",
            headers=HEADERS
        )
        r.raise_for_status()

        return jsonify({"status": "deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
