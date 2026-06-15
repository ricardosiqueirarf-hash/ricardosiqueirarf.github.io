import os
import requests
from flask import Blueprint, jsonify, request

# =====================
# CONFIG SUPABASE
# =====================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
SUPABASE_TABLE_FORNECEDORES = os.getenv("SUPABASE_TABLE_FORNECEDORES", "fornecedores")
SUPABASE_TABLE_ASAAS_COBRANCAS = os.getenv("SUPABASE_TABLE_ASAAS_COBRANCAS", "asaas_cobrancas")

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


def _asaas_headers_json():
    return {**HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"}


def _validar_token_webhook_asaas():
    esperado = os.getenv("ASAAS_WEBHOOK_TOKEN") or ""
    if not esperado:
        return True

    data = request.get_json(silent=True) or {}
    recebido = (
        request.headers.get("X-Webhook-Token")
        or request.headers.get("asaas-access-token")
        or request.headers.get("access_token")
        or request.args.get("token")
        or data.get("webhook_token")
        or ""
    )
    return recebido == esperado

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


# =====================
# ROTAS ASAAS
# Registradas aqui porque fornecedores_bp já é importado e registrado no app.py.
# Não altera tabelas existentes; apenas consulta/atualiza asaas_cobrancas.
# =====================


@fornecedores_bp.route("/api/asaas/status", methods=["GET"])
def asaas_status():
    return jsonify({
        "success": True,
        "message": "Integração Asaas carregada",
        "has_api_key": bool(os.getenv("ASAAS_API_KEY")),
        "base_url": os.getenv("ASAAS_BASE_URL") or "https://api.asaas.com/v3",
    })


@fornecedores_bp.route("/api/asaas/webhook", methods=["GET", "POST"])
def asaas_webhook():
    if request.method == "GET":
        return jsonify({
            "success": True,
            "message": "Webhook Asaas ativo",
            "methods": ["GET", "POST"],
        })

    if not _validar_token_webhook_asaas():
        return jsonify({"success": False, "error": "Token do webhook inválido."}), 401

    data = request.get_json(silent=True) or {}
    payment = data.get("payment") or {}
    payment_id = payment.get("id")
    status = payment.get("status")

    if not payment_id:
        return jsonify({"success": True, "message": "Evento ignorado: payment.id ausente."})

    try:
        r = requests.patch(
            f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE_ASAAS_COBRANCAS}?asaas_payment_id=eq.{payment_id}",
            headers=_asaas_headers_json(),
            json={"status": status, "payload": data},
            timeout=20,
        )
        r.raise_for_status()
        return jsonify({"success": True, "payment_id": payment_id, "status": status})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
