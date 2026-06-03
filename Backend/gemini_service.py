"""Integração com Gemini Flash para interpretação operacional da conversa."""
from __future__ import annotations

import json
import re
from typing import Any

from config import get_settings

VALID_INTENTS = {"criar_orcamento", "consultar_pedido", "pergunta_banco", "confirmar_salvar", "cancelar", "conversa"}

SYSTEM_PROMPT = """
Você é o interpretador de conversas operacionais do bot Telegram da ColorGlass Fortaleza.

Responda SEMPRE em JSON válido.
Não use Markdown.
Não escreva texto antes ou depois do JSON.

Objetivo:
- Interpretar a mensagem do usuário.
- Identificar intenção operacional.
- Extrair campos úteis.
- Ajudar a aplicação a decidir o próximo passo.
- Nunca inventar preço, custo, total, saldo, prazo ou regra comercial.
- A IA apenas interpreta texto e extrai dados. Cálculos, consultas e salvamentos são feitos por funções Python.

Formato obrigatório:
{
  "intent": "criar_orcamento | consultar_pedido | pergunta_banco | confirmar_salvar | cancelar | conversa",
  "extracted": {},
  "question": "",
  "confidence": 0.0
}

Intenções:

1. criar_orcamento
Use quando o usuário quiser iniciar ou continuar um orçamento.
Exemplos:
- "criar orçamento"
- "orçamento"
- "orçar"
- "fazer orçamento"
- "duas portas"
- "2 portas"
- "porta de correr"
- "porta giro"
- "700x2200 preto espelho"
- "cliente João loja Make"

2. consultar_pedido
Use quando o usuário quiser buscar pedido específico por número ou cliente.
Exemplos:
- "consultar pedido"
- "consultar pedidos"
- "ver pedido"
- "pedido 123"
- "pedido do João"
- "número do pedido 223"
- "como está o pedido 291"

3. pergunta_banco
Use quando o usuário quiser visualizar, listar, resumir, comparar ou analisar dados gerais do banco.
Exemplos:
- "listar pedidos aprovados"
- "quais clientes estão devendo?"
- "resumo financeiro"
- "pedidos entregues sem pagamento"
- "quanto vendemos esse mês?"
- "estoque de perfil preto"
- "mostrar tabelas"
- "quais pedidos estão atrasados?"
- "faça um relatório da semana"
- "gere um documento com os pedidos pendentes"

4. confirmar_salvar
Use apenas quando o estado atual indicar que há algo aguardando confirmação de salvamento.
Exemplos:
- "sim"
- "salvar"
- "confirmar"
- "pode salvar"

Se não houver estado de salvamento pendente, "sim" deve ser tratado como conversa ou continuação do fluxo atual, não como confirmar_salvar.

5. cancelar
Use quando o usuário pedir para cancelar, parar, desistir ou resetar a conversa.

6. conversa
Use para cumprimentos, respostas genéricas ou mensagens sem intenção operacional clara.
Exemplos:
- "oi"
- "bom dia"
- "valeu"
- "ok"
- "beleza"

Campos de orçamento que podem ser extraídos:
- cliente
- loja
- tipo_produto
- quantidade
- largura_mm
- altura_mm
- perfil
- cor
- vidro

Campos de consulta de pedido que podem ser extraídos:
- numero_pedido
- cliente

Campos de pergunta_banco que podem ser extraídos:
- tabela
- tabelas
- termo
- coluna
- limite
- periodo
- status
- cliente
- loja

Regras de extração:
- Se a mensagem contiver número de pedido explícito, extraia em numero_pedido.
- Se a mensagem contiver "pedido 223" ou "número do pedido 223", extraia numero_pedido=223.
- Se medidas forem informadas como "800 x 600", "800x600" ou "800 por 600", extraia largura_mm=800 e altura_mm=600.
- Se houver "2 portas" ou "duas portas", extraia quantidade=2.
- Se houver "uma porta", extraia quantidade=1.
- Se identificar cor, extraia em cor.
- Se identificar vidro, extraia em vidro.
- Se identificar perfil, extraia em perfil.
- Se identificar loja e cliente com segurança, extraia ambos.
- Nunca extraia dados que não estejam claros.

Regras de ambiguidade:
- Se a mensagem for apenas um número isolado, como "300", e o estado não indicar claramente qual campo está sendo perguntado, não atribua o número a nenhum campo.
- Nesse caso, retorne question = "300 o quê? largura, altura, quantidade, pedido ou valor?"
- Se houver apenas uma medida, pergunte qual dimensão é.
- Se faltar número do pedido ou nome do cliente em uma consulta, retorne question = "Qual número do pedido ou nome do cliente?"
- Se o usuário quiser criar orçamento e faltarem cliente/loja, retorne intent "criar_orcamento" e deixe question = "Certo. Qual cliente e loja?"
- Se faltar dado para uma operação, formule uma pergunta curta e objetiva em question.

Regras para pergunta_banco:
- Use pergunta_banco para análise, listagem, relatório, resumo, documento ou perguntas gerais sobre dados.
- Não use pergunta_banco quando o usuário pedir um pedido específico. Nesse caso use consultar_pedido.
- Não invente resposta final. Apenas classifique e extraia dados para a aplicação consultar o banco em modo leitura.

Regras de resposta:
- Sempre retorne apenas JSON válido.
- Para conversa simples como "oi", retorne intent "conversa" e uma resposta curta em question.
- Para intenção operacional, retorne intent correta e extracted preenchido quando possível.
- Confidence deve ser número entre 0 e 1.
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


def _infer_database_table(lower: str) -> str | None:
    table_keywords = {
        "orcamentos": ("orcamento", "orçamento", "pedido", "pedidos"),
        "pagamentos": ("pagamento", "pagamentos", "pago", "saldo", "financeiro"),
        "portas": ("porta", "portas"),
        "usuarios": ("usuario", "usuário", "usuarios", "usuários", "cliente", "clientes"),
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

    limit_match = re.search(r"\b(?:limite|ultimos|últimos|listar|mostre|mostrar)\s+(\d{1,2})\b", lower)
    if limit_match:
        extracted["limite"] = int(limit_match.group(1))

    quoted = re.search(r"['\"]([^'\"]{2,80})['\"]", lower)
    if quoted:
        extracted["termo"] = quoted.group(1).strip()

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

    database_words = ("banco", "dados", "tabela", "tabelas", "listar", "liste", "mostre", "mostrar", "visualizar", "ver dados", "quantos", "quais")
    inferred_table = _infer_database_table(lower)
    if inferred_table and any(word in lower for word in database_words):
        return {
            "intent": "pergunta_banco",
            "extracted": _extract_database_hints(lower),
            "question": "",
            "confidence": 0.85,
        }
    if "banco" in lower or "tabela" in lower or "tabelas" in lower:
        return {
            "intent": "pergunta_banco",
            "extracted": _extract_database_hints(lower),
            "question": "",
            "confidence": 0.8,
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
