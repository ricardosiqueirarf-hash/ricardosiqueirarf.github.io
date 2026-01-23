import os
import requests
from flask import Blueprint, request, jsonify

# =====================
# CONFIG SUPABASE
# =====================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL ou SUPABASE_KEY não configurados")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

# =====================
# BLUEPRINT
# =====================

trilhos_bp = Blueprint("trilhos_bp", __name__)

# =====================
# ROTAS TRILHOS
# =====================


@trilhos_bp.route("/api/trilhos", methods=["GET"])
def listar_trilhos():
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/trilhos?select=*&order=nome.asc",
            headers=HEADERS,
            timeout=20,
        )
        if not r.ok:
            return jsonify({"error": r.text, "status": r.status_code}), r.status_code
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@trilhos_bp.route("/api/trilhos", methods=["POST"])
def criar_trilho():
    try:
        data = request.json or {}
        preco = float(data.get("preco", 0))

        payload = {
            "nome": data["nome"],
            "custo": data["custo"],
            "margem": data["margem"],
            "preco": round(preco, 2),
            "tipo": data.get("tipo", []),
        }

        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/trilhos",
            headers=HEADERS,
            json=payload,
            timeout=20,
        )
        if not r.ok:
            return jsonify({"error": r.text, "status": r.status_code}), r.status_code

        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@trilhos_bp.route("/api/trilhos/<id>", methods=["PUT"])
def editar_trilho(id):
    try:
        data = request.json or {}
        preco = float(data.get("preco", 0))

        payload = {
            "nome": data["nome"],
            "custo": data["custo"],
            "margem": data["margem"],
            "preco": round(preco, 2),
            "tipo": data.get("tipo", []),
        }

        r = requests.patch(
            f"{SUPABASE_URL}/rest/v1/trilhos?id=eq.{id}",
            headers=HEADERS,
            json=payload,
            timeout=20,
        )
        if not r.ok:
            return jsonify({"error": r.text, "status": r.status_code}), r.status_code

        return jsonify({"status": "updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@trilhos_bp.route("/api/trilhos/<id>", methods=["DELETE"])
def deletar_trilho(id):
    try:
        r = requests.delete(
            f"{SUPABASE_URL}/rest/v1/trilhos?id=eq.{id}",
            headers=HEADERS,
            timeout=20,
        )
        if not r.ok:
            return jsonify({"error": r.text, "status": r.status_code}), r.status_code

        return jsonify({"status": "deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
