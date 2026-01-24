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

sistemas_bp = Blueprint("sistemas_bp", __name__)

# =====================
# ROTAS SISTEMAS
# =====================


@sistemas_bp.route("/api/sistemas", methods=["GET"])
def listar_sistemas():
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/sistemas?select=*&order=nome.asc",
            headers=HEADERS,
            timeout=20,
        )
        if not r.ok:
            return jsonify({"error": r.text, "status": r.status_code}), r.status_code
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@sistemas_bp.route("/api/sistemas", methods=["POST"])
def criar_sistema():
    try:
        data = request.json or {}
        nome = (data.get("nome") or "").strip()
        preco = float(data.get("preco", 0))

        if not nome:
            return jsonify({"error": "Nome é obrigatório"}), 400

        payload = {
            "nome": nome,
            "custo": data["custo"],
            "margem": data["margem"],
            "preco": round(preco, 2),
            "trilhos_superior": data.get("trilhos_superior", []),
            "trilhos_inferior": data.get("trilhos_inferior", []),
        }

        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/sistemas",
            headers=HEADERS,
            json=payload,
            timeout=20,
        )
        if not r.ok:
            return jsonify({"error": r.text, "status": r.status_code}), r.status_code

        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@sistemas_bp.route("/api/sistemas/<id>", methods=["PUT"])
def editar_sistema(id):
    try:
        data = request.json or {}
        nome = (data.get("nome") or "").strip()
        preco = float(data.get("preco", 0))

        if not nome:
            return jsonify({"error": "Nome é obrigatório"}), 400

        payload = {
            "nome": nome,
            "custo": data["custo"],
            "margem": data["margem"],
            "preco": round(preco, 2),
            "trilhos_superior": data.get("trilhos_superior", []),
            "trilhos_inferior": data.get("trilhos_inferior", []),
        }

        r = requests.patch(
            f"{SUPABASE_URL}/rest/v1/sistemas?id=eq.{id}",
            headers=HEADERS,
            json=payload,
            timeout=20,
        )
        if not r.ok:
            return jsonify({"error": r.text, "status": r.status_code}), r.status_code

        return jsonify({"status": "updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@sistemas_bp.route("/api/sistemas/<id>", methods=["DELETE"])
def deletar_sistema(id):
    try:
        r = requests.delete(
            f"{SUPABASE_URL}/rest/v1/sistemas?id=eq.{id}",
            headers=HEADERS,
            timeout=20,
        )
        if not r.ok:
            return jsonify({"error": r.text, "status": r.status_code}), r.status_code

        return jsonify({"status": "deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

