"""Integração com Gemini Flash para interpretação operacional da conversa."""
from __future__ import annotations

import json
import re
from typing import Any

from config import get_settings

VALID_INTENTS = {"criar_orcamento", "consultar_pedido", "pergunta_banco", "confirmar_salvar", "cancelar", "conversa"}

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
  "intent": "criar_orcamento | consultar_pedido | pergunta_banco | confirmar_salvar | cancelar | conversa",
  "extracted": {},
  "question": "",
  "confidence": 0.0
}

Intenções:
- criar_orcamento: usuário quer iniciar ou continuar orçamento. Exemplos: "criar orçamento", "orçamento", "orçar", "duas portas", "2 portas", "porta de correr".
- consultar_pedido: usuário quer buscar pedido por número ou cliente. Exemplos: "consultar pedidos", "consultar pedido", "ver pedido", "pedido 123", "pedido do João".
- pergunta_banco: usuário quer conversar livremente sobre dados do banco, listar/visualizar informações, perguntar sobre tabelas, pagamentos, clientes, estoque, materiais, perfis, vidros, tarefas ou dados gerais.
- confirmar_salvar: usuário confirma salvar com sim, salvar ou confirmar.
- cancelar: usuário pede cancelar/parar/desistir.
- conversa: cumprimento ou assunto geral sem ação operacional.

Campos de orçamento que podem ser extraídos:
cliente, loja, tipo_produto, quantidade, largura_mm, altura_mm, perfil, cor, vidro.

Campos de consulta que podem ser extraídos:
numero_pedido, cliente.

Campos de pergunta_banco que podem ser extraídos:
tabela, tabelas, termo, coluna, limite.

Regras de ambiguidade:
- Se a mensagem for apenas um número isolado (ex.: "300") e o estado não indicar claramente qual campo está sendo perguntado, NÃO atribua o número a nenhum campo.
- Nesse caso, retorne question = "300 o quê? largura, altura, quantidade ou valor?".
- Se medidas forem informadas como "800 x 600", extraia largura_mm=800 e altura_mm=600.
- Se só houver uma medida, pergunte qual dimensão é.
- Se faltar número do pedido ou nome do cliente em uma consulta, retorne question = "Qual número do pedido ou nome do cliente?".
- Se o usuário quiser criar orçamento e faltarem cliente/loja, retorne intent criar_orcamento e deixe a aplicação perguntar "Certo. Qual cliente e loja?".
- Se faltar dado para uma operação, formule uma pergunta objetiva em question.

Regras de resposta:
- Para perguntas gerais sobre dados do banco, retorne intent "pergunta_banco" e extraia tabela/termo/limite quando possível.
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

    if "porta" in lower:
        extracted["tipo_produto"] = "porta de correr" if "correr" in lower else "porta"

    medida = re.search(r"(\d{2,5})\s*(?:x|por)\s*(\d{2,5})", lower)
    if medida:
        extracted["largura_mm"] = int(medida.group(1))
        extracted["altura_mm"] = int(medida.group(2))

    if "1036" in lower:
        extracted["perfil"] = "1036"
    if "preto" in lower:
        extracted["cor"] = "preto"
    if "prata" in lower:
        extracted["cor"] = "prata"
    if "espelho" in lower:
        extracted["vidro"] = "espelho prata 4mm" if "prata" in lower else "espelho prata 4mm"
    if "reflecta" in lower or "refleta" in lower:
        extracted["vidro"] = "reflecta bronze 4mm" if "bronze" in lower else "reflecta bronze 4mm"

    return extracted


def _infer_database_table(lower: str) -> str | None:
    table_keywords = {
        "orcamentos": ("orcamento", "orçamento", "pedido", "pedidos", "venda", "vendas"),
        "pagamentos": ("pagamento", "pagamentos", "pago", "saldo", "financeiro", "devendo", "devedor", "devedores"),
        "portas": ("porta", "portas"),
        "usuarios": ("usuario", "usuário", "usuarios", "usuários"),
        "clientes": ("cliente", "clientes"),
        "materiais": ("material", "materiais", "insumo", "insumos", "estoque"),
        "perfis": ("perfil", "perfis", "aluminio", "alumínio"),
        "vidros": ("vidro", "vidros", "espelho", "reflecta"),
        "puxadores": ("puxador", "puxadores"),
        "trilhos": ("trilho", "trilhos"),
        "sistemas": ("sistema", "sistemas"),
        "fornecedores": ("fornecedor", "fornecedores"),
        "tarefas": ("tarefa", "tarefas"),
        "tags": ("tag", "tags"),
        "comprovantes": ("comprovante", "comprovantes"),
        "estruturas": ("estrutura", "estruturas"),
    }
    for table, keywords in table_keywords.items():
        if any(keyword in lower for keyword in keywords):
            return table
    return None


def _extract_database_hints(lower: str) -> dict[str, Any]:
    extracted: dict[str, Any] = {}
    table = _infer_database_table(lower)
    if table:
        extracted["tabela"] = table
    if "quais tabelas" in lower or "tabelas existem" in lower:
        extracted["tabelas"] = True
    limit_match = re.search(r"\b(?:limite|limit|listar|mostre)\s+(\d{1,2})\b", lower)
    if limit_match:
        extracted["limite"] = int(limit_match.group(1))
    name_match = re.search(r"\b(?:cliente|do|da)\s+([a-záàâãéêíóôõúç][\wáàâãéêíóôõúç ]{2,})", lower)
    if name_match:
        extracted["termo"] = name_match.group(1).strip()
    return extracted


def _keyword_intent(user_message: str, state: dict[str, Any] | None) -> dict[str, Any] | None:
    lower = user_message.lower().strip()

    if (state or {}).get("mode") == "orcamento":
        return {
            "intent": "criar_orcamento",
            "extracted": _extract_budget_hints(lower),
            "question": "",
            "confidence": 0.9,
        }

    if re.search(r"\bpedido\s*(\d+)\b", lower):
        return {
            "intent": "consultar_pedido",
            "extracted": {"numero_pedido": re.search(r"\bpedido\s*(\d+)\b", lower).group(1)},
            "question": "",
            "confidence": 0.95,
        }

    if any(keyword in lower for keyword in ("quais tabelas", "tabelas existem", "banco", "dados", "relatório", "relatorio", "financeiro", "devendo", "devedores", "vendas", "compare", "analise", "análise")):
        return {
            "intent": "pergunta_banco",
            "extracted": _extract_database_hints(lower),
            "question": "",
            "confidence": 0.88,
        }

    if any(keyword in lower for keyword in ("consultar pedido", "consultar pedidos", "ver pedido", "como está o pedido", "como esta o pedido")):
        numero_match = re.search(r"\b(\d+)\b", lower)
        return {
            "intent": "consultar_pedido",
            "extracted": {"numero_pedido": numero_match.group(1)} if numero_match else {},
            "question": "" if numero_match else "Qual número do pedido ou nome do cliente?",
            "confidence": 0.9,
        }

    if lower.startswith("pedido do ") or lower.startswith("pedido da "):
        cliente = re.sub(r"^pedido d[oa]\s+", "", lower).strip()
        return {
            "intent": "consultar_pedido",
            "extracted": {"cliente": cliente} if cliente else {},
            "question": "" if cliente else "Qual número do pedido ou nome do cliente?",
            "confidence": 0.85,
        }

    if "pedido" in lower or "consultar" in lower:
        numero_match = re.search(r"\b(\d+)\b", lower)
        return {
            "intent": "consultar_pedido",
            "extracted": {"numero_pedido": numero_match.group(1)} if numero_match else {},
            "question": "" if numero_match else "Qual número do pedido ou nome do cliente?",
            "confidence": 0.78,
        }

    if any(keyword in lower for keyword in ("orçamento", "orcamento", "orçar", "orcar", "porta", "portas", "duas", "2")):
        return {
            "intent": "criar_orcamento",
            "extracted": _extract_budget_hints(lower),
            "question": "",
            "confidence": 0.82,
        }

    return None


def _extract_order_number(text: str) -> str | None:
    match = re.search(r"\b(?:pedido|n[úu]mero|numero)?\s*#?\s*(\d{1,10})\b", text.lower())
    return match.group(1) if match else None


def _extract_customer_name(text: str) -> str | None:
    lower = text.lower()
    match = re.search(r"pedido\s+d[oa]\s+(.+)$", lower)
    if match:
        return match.group(1).strip()
    return None


def _merge_extracted_with_regex(result: dict[str, Any], user_message: str) -> dict[str, Any]:
    extracted = dict(result.get("extracted", {}))
    lower = user_message.lower()

    if result.get("intent") == "consultar_pedido":
        numero = _extract_order_number(lower)
        cliente = _extract_customer_name(lower)
        if numero and not extracted.get("numero_pedido"):
            extracted["numero_pedido"] = numero
        if cliente and not extracted.get("cliente"):
            extracted["cliente"] = cliente

    if result.get("intent") == "criar_orcamento":
        extracted.update({k: v for k, v in _extract_budget_hints(lower).items() if not extracted.get(k)})

    if result.get("intent") == "pergunta_banco":
        extracted.update({k: v for k, v in _extract_database_hints(lower).items() if not extracted.get(k)})

    result["extracted"] = extracted
    return result


def _apply_keyword_fallback(result: dict[str, Any], user_message: str, state: dict[str, Any] | None) -> dict[str, Any]:
    keyword_result = _keyword_intent(user_message, state)
    if not keyword_result:
        return result

    generic_conversation = result.get("intent") == "conversa" and result.get("confidence", 0) < 0.85
    weak_intent = result.get("confidence", 0) < 0.55
    if generic_conversation or weak_intent:
        return keyword_result

    if (state or {}).get("mode") == "orcamento" and result.get("intent") not in {"cancelar", "confirmar_salvar"}:
        return keyword_result

    if keyword_result["intent"] in {"consultar_pedido", "criar_orcamento", "pergunta_banco"} and result.get("intent") == "conversa":
        return keyword_result

    return result


def interpretar_mensagem(user_message: str, state: dict[str, Any] | None = None) -> dict[str, Any]:
    """Interpreta mensagem do usuário e retorna JSON estruturado."""
    settings = get_settings()
    state = state or {}

    prompt = f"""
{SYSTEM_PROMPT}

Estado atual da conversa:
{json.dumps(state, ensure_ascii=False, default=str)}

Mensagem do usuário:
{user_message}
""".strip()

    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.gemini_model, generation_config={"temperature": 0.1})
        response = model.generate_content(prompt)
        result = _sanitize_response(_extract_json(response.text or ""))
    except Exception:
        result = _local_fallback(user_message, state)

    result = _merge_extracted_with_regex(result, user_message)
    return _apply_keyword_fallback(result, user_message, state)


def responder_com_dados(user_message: str, db_context: dict[str, Any]) -> str:
    """Gera resposta natural usando somente os dados read-only fornecidos pelo Python."""
    settings = get_settings()
    prompt = f"""
Você é um assistente da ColorGlass. Responda à pergunta do usuário em português, de forma direta e útil.
Use SOMENTE os dados fornecidos no contexto JSON. Não invente dados, valores, status ou registros.
Se o contexto estiver vazio, diga que não encontrou dados suficientes.
Nunca sugira que alterou, salvou ou atualizou o banco.

Pergunta do usuário:
{user_message}

Contexto JSON somente leitura:
{json.dumps(db_context, ensure_ascii=False, default=str)}
""".strip()

    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(
            settings.gemini_model,
            generation_config={"temperature": 0.2, "max_output_tokens": 1200},
        )
        response = model.generate_content(prompt)
        return (response.text or "").strip() or "Não encontrei dados suficientes para responder."
    except Exception:
        return "Encontrei dados, mas não consegui gerar um resumo com a IA agora. Veja os dados retornados no resumo da consulta."


def responder_conversa_livre(user_message: str, state: dict[str, Any] | None = None) -> str:
    """Responde conversas comuns com o prompt configurável do assistente virtual."""
    settings = get_settings()
    state = state or {}
    prompt = f"""
{settings.assistant_prompt}

Contexto operacional atual, se houver:
{json.dumps(state, ensure_ascii=False, default=str)}

Mensagem do usuário:
{user_message}
""".strip()

    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(
            settings.gemini_model,
            generation_config={"temperature": 0.7, "max_output_tokens": 900},
        )
        response = model.generate_content(prompt)
        text = (response.text or "").strip()
        if text:
            return text
    except Exception:
        pass

    return "Olá! Sou o assistente virtual da ColorGlass Fortaleza. Como posso ajudar você hoje?"


def gerar_sql_somente_leitura_com_gemini(user_message: str, schema_context: str) -> str:
    """Gera apenas SQL SELECT para o database_agent usando o schema permitido."""
    settings = get_settings()
    prompt = f"""
Você gera SQL PostgreSQL para análise interna da ColorGlass.
Responda SOMENTE com a SQL, sem Markdown, sem explicação e sem comentários.

Regras obrigatórias:
- Use apenas SELECT ou WITH que termine em SELECT.
- Nunca use INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, MERGE ou UPSERT.
- Use apenas tabelas e colunas existentes no schema fornecido.
- Nunca selecione colunas sensíveis como senha, password, token, secret, service_role, authorization, apikey, api_key ou chave.
- Sempre inclua LIMIT.
- Se não souber gerar com segurança, responda exatamente: SELECT 'Não consegui gerar uma consulta segura' AS erro LIMIT 1

Schema disponível:
{schema_context}

Pergunta do usuário:
{user_message}
""".strip()

    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(
            settings.gemini_model,
            generation_config={"temperature": 0.0, "max_output_tokens": 700},
        )
        response = model.generate_content(prompt)
        return (response.text or "").strip()
    except Exception:
        return ""
