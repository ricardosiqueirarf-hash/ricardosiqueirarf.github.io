"""Integração com Gemini Flash para interpretação operacional da conversa."""
from __future__ import annotations

import json
import re
from typing import Any

from config import get_settings

VALID_INTENTS = {"criar_orcamento", "consultar_pedido", "confirmar_salvar", "cancelar", "conversa"}

SYSTEM_PROMPT = """
Você é o interpretador de conversas operacionais do bot Telegram da ColorGlass.
Responda SEMPRE em JSON válido, sem Markdown, sem texto antes ou depois.

Objetivo:
- Interpretar a mensagem do usuário.
- Extrair campos para consultar pedidos ou criar orçamento.
- Nunca inventar preço, custo, total, saldo ou regras comerciais.
- A IA apenas interpreta texto e extrai dados. O cálculo é feito por função fixa Python.

Formato obrigatório:
{
  "intent": "criar_orcamento | consultar_pedido | confirmar_salvar | cancelar | conversa",
  "extracted": {},
  "question": "",
  "confidence": 0.0
}

Intenções:
- criar_orcamento: usuário quer iniciar ou continuar orçamento. Exemplos: "criar orçamento", "orçamento", "orçar", "duas portas", "2 portas", "porta de correr".
- consultar_pedido: usuário quer buscar pedido por número ou cliente. Exemplos: "consultar pedidos", "consultar pedido", "ver pedido", "pedido 123", "pedido do João".
- confirmar_salvar: usuário confirma salvar com sim, salvar ou confirmar.
- cancelar: usuário pede cancelar/parar/desistir.
- conversa: cumprimento ou assunto geral sem ação operacional.

Campos de orçamento que podem ser extraídos:
cliente, loja, tipo_produto, quantidade, largura_mm, altura_mm, perfil, cor, vidro.

Campos de consulta que podem ser extraídos:
numero_pedido, cliente.

Regras de ambiguidade:
- Se a mensagem for apenas um número isolado (ex.: "300") e o estado não indicar claramente qual campo está sendo perguntado, NÃO atribua o número a nenhum campo.
- Nesse caso, retorne question = "300 o quê? largura, altura, quantidade ou valor?".
- Se medidas forem informadas como "800 x 600", extraia largura_mm=800 e altura_mm=600.
- Se só houver uma medida, pergunte qual dimensão é.
- Se faltar número do pedido ou nome do cliente em uma consulta, retorne question = "Qual número do pedido ou nome do cliente?".
- Se o usuário quiser criar orçamento e faltarem cliente/loja, retorne intent criar_orcamento e deixe a aplicação perguntar "Certo. Qual cliente e loja?".
- Se faltar dado para uma operação, formule uma pergunta objetiva em question.

Regras de resposta:
- Para conversa simples como "oi", retorne intent "conversa" e uma pergunta/resposta amigável em question.
- Para intenção operacional, nunca retorne texto solto; apenas JSON.
- Confidence deve ficar entre 0 e 1.
""".strip()


def _default_response(message: str = "Como posso ajudar?") -> dict[str, Any]:
    return {"intent": "conversa", "extracted": {}, "question": message, "confidence": 0.0}


def _extract_json(text: str) -> dict[str, Any]:
    clean = text.strip()
    if clean.startswith("```"):
        clean = re.sub(r"^```(?:json)?\s*", "", clean)
        clean = re.sub(r"\s*```$", "", clean)
    match = re.search(r"\{.*\}", clean, re.DOTALL)
    if match:
        clean = match.group(0)
    return json.loads(clean)


def _sanitize_response(data: dict[str, Any]) -> dict[str, Any]:
    intent = data.get("intent", "conversa")
    if intent not in VALID_INTENTS:
        intent = "conversa"

    confidence = data.get("confidence", 0.0)
    try:
        confidence = max(0.0, min(1.0, float(confidence)))
    except (TypeError, ValueError):
        confidence = 0.0

    extracted = data.get("extracted")
    if not isinstance(extracted, dict):
        extracted = {}

    question = data.get("question") or ""

    return {
        "intent": intent,
        "extracted": extracted,
        "question": str(question),
        "confidence": confidence,
    }


def _local_fallback(user_message: str, state: dict[str, Any] | None) -> dict[str, Any]:
    """Fallback determinístico para casos críticos se Gemini estiver indisponível."""
    text = user_message.strip()
    lower = text.lower()

    if re.fullmatch(r"\d+(?:[,.]\d+)?", lower):
        return {
            "intent": "criar_orcamento" if (state or {}).get("mode") == "orcamento" else "conversa",
            "extracted": {},
            "question": f"{text} o quê? largura, altura, quantidade ou valor?",
            "confidence": 0.7,
        }

    if lower in {"sim", "salvar", "confirmar"}:
        return {"intent": "confirmar_salvar", "extracted": {}, "question": "", "confidence": 0.95}
    if lower in {"cancelar", "parar", "desistir"}:
        return {"intent": "cancelar", "extracted": {}, "question": "", "confidence": 0.95}

    keyword_result = _keyword_intent(user_message, state)
    if keyword_result:
        return keyword_result

    if lower in {"oi", "olá", "ola", "bom dia", "boa tarde", "boa noite"}:
        return {
            "intent": "conversa",
            "extracted": {},
            "question": "Olá! Posso consultar um pedido ou criar um orçamento para você.",
            "confidence": 0.8,
        }

    return _default_response("Olá! Posso consultar um pedido ou criar um orçamento para você.")


def _extract_budget_hints(lower: str) -> dict[str, Any]:
    """Extrai pistas simples de orçamento quando o Gemini não classifica bem."""
    extracted: dict[str, Any] = {}
    if re.search(r"\b(2|duas|dois)\b", lower):
        extracted["quantidade"] = 2
    elif re.search(r"\b(1|uma|um)\b", lower):
        extracted["quantidade"] = 1

    if "porta" in lower or "portas" in lower:
        if "correr" in lower:
            extracted["tipo_produto"] = "porta de correr"
        else:
            extracted["tipo_produto"] = "porta"

    medida_match = re.search(r"(\d+(?:[,.]\d+)?)\s*[xX]\s*(\d+(?:[,.]\d+)?)", lower)
    if medida_match:
        extracted["largura_mm"] = medida_match.group(1).replace(",", ".")
        extracted["altura_mm"] = medida_match.group(2).replace(",", ".")

    return extracted


def _keyword_intent(user_message: str, state: dict[str, Any] | None) -> dict[str, Any] | None:
    """Fallback por palavras-chave para evitar resposta genérica em intenções claras."""
    text = user_message.strip()
    lower = text.lower()
    state = state or {}

    if state.get("mode") == "orcamento" and lower not in {"sim", "salvar", "confirmar", "cancelar", "parar", "desistir"}:
        return {
            "intent": "criar_orcamento",
            "extracted": _extract_budget_hints(lower),
            "question": "",
            "confidence": 0.85,
        }

    pedido_match = re.search(r"\bpedido\s*(?:n[ºo.]*)?\s*(\d+)\b", lower)
    if pedido_match:
        return {
            "intent": "consultar_pedido",
            "extracted": {"numero_pedido": pedido_match.group(1)},
            "question": "",
            "confidence": 0.95,
        }

    cliente_match = re.search(r"\bpedido\s+(?:do|da|de)\s+(.+)$", lower)
    if cliente_match:
        return {
            "intent": "consultar_pedido",
            "extracted": {"cliente": cliente_match.group(1).strip()},
            "question": "",
            "confidence": 0.85,
        }

    if "pedido" in lower or "consultar" in lower:
        return {
            "intent": "consultar_pedido",
            "extracted": {},
            "question": "Qual número do pedido ou nome do cliente?",
            "confidence": 0.85,
        }

    budget_keywords = ("orçamento", "orcamento", "orçar", "orcar", "porta", "portas", "duas", "dois")
    if any(keyword in lower for keyword in budget_keywords) or re.search(r"\b2\b", lower):
        return {
            "intent": "criar_orcamento",
            "extracted": _extract_budget_hints(lower),
            "question": "",
            "confidence": 0.85,
        }

    return None


def _apply_keyword_fallback(result: dict[str, Any], user_message: str, state: dict[str, Any] | None) -> dict[str, Any]:
    """Corrige classificações genéricas quando há sinal claro de pedido/orçamento."""
    keyword_result = _keyword_intent(user_message, state)
    if not keyword_result:
        return result

    intent = result.get("intent")
    confidence = float(result.get("confidence") or 0)
    generic_question = "Posso consultar pedidos ou criar orçamentos" in (result.get("question") or "")

    if intent == "conversa" or confidence < 0.65 or generic_question:
        merged_extracted = dict(keyword_result.get("extracted", {}))
        merged_extracted.update(result.get("extracted") or {})
        keyword_result["extracted"] = merged_extracted
        return keyword_result

    return result


def interpretar_mensagem(user_message: str, state: dict[str, Any] | None = None) -> dict[str, Any]:
    settings = get_settings()
    state = state or {}

    prompt = f"""
{SYSTEM_PROMPT}

Estado atual da conversa em JSON:
{json.dumps(state, ensure_ascii=False)}

Mensagem do usuário:
{user_message}
""".strip()

    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(
            settings.gemini_model,
            generation_config={
                "temperature": 0.1,
                "max_output_tokens": 800,
                "response_mime_type": "application/json",
            },
        )
        response = model.generate_content(prompt)
        result = _sanitize_response(_extract_json(response.text or "{}"))
        return _apply_keyword_fallback(result, user_message, state)
    except Exception:
        return _local_fallback(user_message, state)
