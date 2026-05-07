import os
import requests
from flask import Blueprint, jsonify, request

# =====================
# CONFIG SUPABASE
# =====================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
SUPABASE_TABLE_FORNECEDORES = os.getenv("SUPABASE_TABLE_FORNECEDORES", "fornecedores")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL ou chave do Supabase não configurados")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# =====================
# BLUEPRINT
# =====================

fornecedores_bp = Blueprint("fornecedores_bp", __name__)

# =====================
# HELPERS
# =====================


def _supabase_url(query=""):
    base = f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE_FORNECEDORES}"
    return f"{base}{query}"


def _normalizar_produtos_e_precos(valor):
    if isinstance(valor, dict):
        return valor
    return {}


def _validar_payload(data):
    fornecedor = (data.get("fornecedor") or "").strip()
    if not fornecedor:
        return None, (jsonify({"error": "O campo fornecedor é obrigatório"}), 400)

    produtos_e_precos = _normalizar_produtos_e_precos(data.get("produtos_e_precos"))
    return {
        "fornecedor": fornecedor,
        "produtos_e_precos": produtos_e_precos,
    }, None


def _resposta_supabase(response):
    response.raise_for_status()
    data = response.json() if response.content else []
    return jsonify(data)

# =====================
# ROTAS FORNECEDORES
# =====================


@fornecedores_bp.route("/api/fornecedores", methods=["GET"])
def listar_fornecedores():
    try:
        r = requests.get(
            _supabase_url("?select=id,fornecedor,produtos_e_precos&order=fornecedor.asc"),
            headers=HEADERS,
        )
        return _resposta_supabase(r)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@fornecedores_bp.route("/api/fornecedores", methods=["POST"])
def criar_fornecedor():
    try:
        data = request.json or {}
        payload, erro = _validar_payload(data)
        if erro:
            return erro

        r = requests.post(
            _supabase_url(),
            headers=HEADERS,
            json=payload,
        )
        return _resposta_supabase(r), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@fornecedores_bp.route("/api/fornecedores/<int:fornecedor_id>", methods=["PUT", "PATCH"])
def editar_fornecedor(fornecedor_id):
    try:
        data = request.json or {}
        payload, erro = _validar_payload(data)
        if erro:
            return erro

        r = requests.patch(
            _supabase_url(f"?id=eq.{fornecedor_id}"),
            headers=HEADERS,
            json=payload,
        )
        return _resposta_supabase(r)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@fornecedores_bp.route("/api/fornecedores/<int:fornecedor_id>", methods=["DELETE"])
def deletar_fornecedor(fornecedor_id):
    try:
        r = requests.delete(
            _supabase_url(f"?id=eq.{fornecedor_id}"),
            headers=HEADERS,
        )
        r.raise_for_status()
        return jsonify({"status": "deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
