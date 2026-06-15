import os

import requests
from flask import Blueprint, jsonify, request


asaas_bp = Blueprint("asaas_bp", __name__)
TABELA_ASAAS_COBRANCAS = os.getenv("SUPABASE_TABLE_ASAAS_COBRANCAS", "asaas_cobrancas")


def _headers_json(headers):
    return {**headers, "Content-Type": "application/json", "Prefer": "return=representation"}


def _validar_token_webhook():
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


@asaas_bp.route("/api/asaas/webhook", methods=["GET", "POST"])
def asaas_webhook():
    if request.method == "GET":
        return jsonify({
            "success": True,
            "message": "Webhook Asaas ativo",
            "methods": ["GET", "POST"]
        })

    if not _validar_token_webhook():
        return jsonify({"success": False, "error": "Token do webhook inválido."}), 401

    data = request.get_json(silent=True) or {}
    payment = data.get("payment") or {}
    payment_id = payment.get("id")
    status = payment.get("status")

    if not payment_id:
        return jsonify({"success": True, "message": "Evento ignorado: payment.id ausente."})

    try:
        from app import SUPABASE_URL, HEADERS

        r = requests.patch(
            f"{SUPABASE_URL}/rest/v1/{TABELA_ASAAS_COBRANCAS}?asaas_payment_id=eq.{payment_id}",
            headers=_headers_json(HEADERS),
            json={"status": status, "payload": data},
            timeout=20,
        )
        r.raise_for_status()
        return jsonify({"success": True, "payment_id": payment_id, "status": status})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@asaas_bp.route("/api/asaas/status", methods=["GET"])
def asaas_status():
    return jsonify({
        "success": True,
        "message": "Integração Asaas carregada",
        "has_api_key": bool(os.getenv("ASAAS_API_KEY")),
        "base_url": os.getenv("ASAAS_BASE_URL") or "https://api.asaas.com/v3"
    })
