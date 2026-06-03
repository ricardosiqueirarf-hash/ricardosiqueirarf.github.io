"""Bot Telegram via webhook para ColorGlass com Flask, Gemini Flash e Supabase."""
from __future__ import annotations

from typing import Any

import requests
from flask import Flask, jsonify, request

from config import get_settings
from conversation_state import get_initial_state, reset_state
from gemini_service import interpretar_mensagem
from supabase_service import carregar_estado_conversa, limpar_estado_conversa, salvar_estado_conversa
from tools import handle_confirmar_salvar, handle_consultar_pedido, handle_criar_orcamento

app = Flask(__name__)


def _telegram_api_url(method: str) -> str:
    settings = get_settings()
    return f"https://api.telegram.org/bot{settings.telegram_token}/{method}"


def _telegram_post(method: str, payload: dict[str, Any]) -> dict[str, Any]:
    response = requests.post(_telegram_api_url(method), json=payload, timeout=15)
    response.raise_for_status()
    return response.json()


def _telegram_get(method: str) -> dict[str, Any]:
    response = requests.get(_telegram_api_url(method), timeout=15)
    response.raise_for_status()
    return response.json()


def send_telegram_message(chat_id: str | int, text: str) -> bool:
    """Envia mensagem para o Telegram e retorna True quando a API confirma o envio."""
    payload = {"chat_id": chat_id, "text": text}
    try:
        result = _telegram_post("sendMessage", payload)
        return bool(result.get("ok"))
    except requests.RequestException as exc:
        app.logger.exception("Falha ao enviar mensagem para Telegram: %s", exc)
        return False


def _extract_message(update: dict[str, Any]) -> tuple[str | int | None, str | None]:
    message = update.get("message") or update.get("edited_message") or {}
    chat = message.get("chat") or {}
    text = message.get("text")
    return chat.get("id"), text


def _process_text(chat_id: str | int, text: str) -> str:
    state = carregar_estado_conversa(chat_id) or get_initial_state()
    gemini_result = interpretar_mensagem(text, state)
    intent = gemini_result.get("intent", "conversa")
    extracted = gemini_result.get("extracted", {})
    question = gemini_result.get("question", "")

    if intent == "cancelar":
        limpar_estado_conversa(chat_id)
        return "Conversa cancelada. Quando quiser, posso consultar pedido ou criar orçamento."

    if intent == "confirmar_salvar":
        return handle_confirmar_salvar(chat_id, state)

    if intent == "consultar_pedido":
        return handle_consultar_pedido(extracted)

    if intent == "criar_orcamento" or state.get("mode") == "orcamento":
        if question and not extracted:
            state["last_question"] = question
            salvar_estado_conversa(chat_id, state)
            return question
        updated_state, response = handle_criar_orcamento(state, extracted)
        salvar_estado_conversa(chat_id, updated_state)
        return response

    return question or "Olá! Posso consultar pedidos ou criar um orçamento para você."


def _resolve_webhook_url(payload: dict[str, Any]) -> str:
    settings = get_settings()
    explicit_url = payload.get("url") or request.args.get("url")
    if explicit_url:
        return str(explicit_url).strip()
    if settings.public_base_url:
        return f"{settings.public_base_url}/telegram/webhook"
    return ""


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/telegram/webhook", methods=["POST"])
def telegram_webhook():
    update = request.get_json(silent=True) or {}
    chat_id, text = _extract_message(update)

    if not chat_id or not text:
        app.logger.info("Update Telegram ignorado por não conter chat_id/texto: %s", update)
        return jsonify({"ok": True, "ignored": True})

    try:
        response_text = _process_text(chat_id, text)
    except Exception as exc:
        app.logger.exception("Erro ao processar mensagem do chat %s: %s", chat_id, exc)
        response_text = "Tive um erro interno ao processar sua mensagem. Tente novamente em instantes."

    sent = send_telegram_message(chat_id, response_text)
    return jsonify({"ok": True, "sent": sent})


@app.route("/telegram/get-me", methods=["GET"])
def telegram_get_me():
    """Diagnóstico: confirma se o TELEGRAM_TOKEN aponta para um bot válido."""
    try:
        return jsonify(_telegram_get("getMe"))
    except requests.RequestException as exc:
        app.logger.exception("Falha ao chamar getMe: %s", exc)
        return jsonify({"ok": False, "error": "Falha ao consultar getMe no Telegram."}), 502


@app.route("/telegram/webhook-info", methods=["GET"])
def telegram_webhook_info():
    """Diagnóstico: mostra qual webhook está configurado no Telegram."""
    try:
        return jsonify(_telegram_get("getWebhookInfo"))
    except requests.RequestException as exc:
        app.logger.exception("Falha ao consultar webhook-info: %s", exc)
        return jsonify({"ok": False, "error": "Falha ao consultar webhook-info no Telegram."}), 502


@app.route("/telegram/set-webhook", methods=["GET", "POST"])
def telegram_set_webhook():
    """Configura o webhook do Telegram usando PUBLIC_BASE_URL ou ?url=https://..."""
    payload = request.get_json(silent=True) or {}
    webhook_url = _resolve_webhook_url(payload)
    if not webhook_url:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "Informe ?url=https://seu-dominio/telegram/webhook ou configure PUBLIC_BASE_URL.",
                }
            ),
            400,
        )

    try:
        result = _telegram_post("setWebhook", {"url": webhook_url})
        return jsonify({"ok": bool(result.get("ok")), "webhook_url": webhook_url, "telegram": result})
    except requests.RequestException as exc:
        app.logger.exception("Falha ao configurar webhook: %s", exc)
        return jsonify({"ok": False, "error": "Falha ao configurar webhook no Telegram."}), 502


@app.route("/telegram/test-message", methods=["POST"])
def telegram_test_message():
    """Diagnóstico: envia mensagem manual para validar TELEGRAM_CHAT_ID e TELEGRAM_TOKEN."""
    settings = get_settings()
    payload = request.get_json(silent=True) or {}
    chat_id = payload.get("chat_id") or settings.telegram_chat_id
    text = payload.get("text") or "Teste do bot ColorGlass: envio manual funcionando."
    sent = send_telegram_message(chat_id, text)
    status_code = 200 if sent else 502
    return jsonify({"ok": sent, "chat_id": str(chat_id)}), status_code


@app.route("/telegram/reset", methods=["POST"])
def telegram_reset():
    payload = request.get_json(silent=True) or {}
    chat_id = payload.get("chat_id")
    if not chat_id:
        return jsonify({"ok": False, "error": "chat_id é obrigatório"}), 400
    limpar_estado_conversa(chat_id)
    salvar_estado_conversa(chat_id, reset_state())
    return jsonify({"ok": True})


if __name__ == "__main__":
    settings = get_settings()
    app.run(host=settings.flask_host, port=settings.flask_port, debug=settings.flask_debug)
