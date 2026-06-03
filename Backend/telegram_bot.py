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


def send_telegram_message(chat_id: str | int, text: str) -> None:
    settings = get_settings()
    url = f"https://api.telegram.org/bot{settings.telegram_token}/sendMessage"
    payload = {"chat_id": chat_id, "text": text}
    try:
        response = requests.post(url, json=payload, timeout=15)
        response.raise_for_status()
    except requests.RequestException as exc:
        app.logger.exception("Falha ao enviar mensagem para Telegram: %s", exc)


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


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/telegram/webhook", methods=["POST"])
def telegram_webhook():
    update = request.get_json(silent=True) or {}
    chat_id, text = _extract_message(update)

    if not chat_id or not text:
        return jsonify({"ok": True, "ignored": True})

    response_text = _process_text(chat_id, text)
    send_telegram_message(chat_id, response_text)
    return jsonify({"ok": True})


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
