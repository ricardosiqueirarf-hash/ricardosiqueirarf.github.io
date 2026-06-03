"""Agente analista read-only para perguntas livres sobre o banco da ColorGlass."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from gemini_service import gerar_resposta_final, gerar_sql
from supabase_service import executar_select

logger = logging.getLogger(__name__)

PROHIBITED_SQL_WORDS = (
    "insert",
    "update",
    "delete",
    "drop",
    "alter",
    "create",
    "truncate",
    "grant",
    "revoke",
    "merge",
    "upsert",
    "copy",
    "execute",
    "call",
    "do",
)

COMMENT_MARKERS = ("--", "/*", "*/", "#")
MAX_SQL_ATTEMPTS = 2

KNOWN_SCHEMA_CONTEXT = """
Você tem acesso TOTAL apenas para VISUALIZAÇÃO ao banco PostgreSQL/Supabase da ColorGlass.
Use somente tabelas e colunas existentes abaixo. Pode consultar qualquer tabela e qualquer coluna.
Nunca gere comandos de escrita; gere apenas SELECT ou WITH.

Tabelas conhecidas:
- estado_conversa
- estoque
- estruturas
- fornecedores
- imagetags
- materiais
- orcamentos
- pagamentos
- perfis
- portas
- puxadores
- sistemas
- tags
- tarefas
- trilhos
- usuarios
- vidros

Tabela estoque:
- id int8
- produto text
- quantidade numeric
- unidade text
- data_contagem timestamptz
- custo numeric
- categoria text

Tabela materiais:
- id int8
- nome text
- custo numeric
- tipo_medida text
- margem numeric
- preco numeric
- perda numeric
- tag text

Tabela orcamentos:
- id uuid
- data_criacao timestamptz
- cliente_nome text
- numero_pedido numeric
- quantidade_total numeric
- valor_total numeric
- userid text
- lojaid text
- status numeric
- data_aprovacao timestamptz
- valor_pago jsonb

Tabela pagamentos:
- id int8
- created_at timestamptz
- orcamentoid uuid
- valor numeric
- forma_pagamento text

Tabela perfis:
- id uuid
- nome text
- custo numeric
- margem numeric
- perda numeric
- preco numeric
- tipologias text
- insumos text
- tags text

Tabela portas:
- id int8
- tipo text
- dados text
- preco numeric
- svg text
- quantidade numeric
- orcamento_uuid uuid
- lojaid text

Tabela puxadores:
- id int8
- nome text
- custo numeric
- tipo_medida text
- margem numeric
- preco numeric
- perda numeric
- insumos jsonb

Tabela vidros:
- id uuid
- tipo text
- espessura numeric
- custo numeric
- margem numeric
- perda numeric
- preco numeric
- tags text

Tabela usuarios:
- userid uuid
- pass text
- user text
- token text
- storeid uuid
- level numeric
- dados jsonb
- nome text

Relações úteis:
- pagamentos.orcamentoid referencia orcamentos.id.
- portas.orcamento_uuid referencia orcamentos.id.
- orcamentos.userid pode se relacionar com usuarios.userid.
- orcamentos.lojaid pode se relacionar com usuarios.storeid ou identificador de loja quando aplicável.

Exemplos de análise:
- Faturamento do mês: somar orcamentos.valor_total filtrando data_aprovacao desde date_trunc('month', now()).
- Último pedido: ordenar orcamentos por data_criacao desc limit 1.
- Saldo aberto: orcamentos.valor_total menos soma de pagamentos.valor por orçamento.
- Valor de estoque: soma de estoque.quantidade * estoque.custo.
""".strip()


class SQLSafetyError(ValueError):
    """Erro levantado quando uma SQL não passa na validação somente leitura."""


def listar_schema_disponivel() -> str:
    """Retorna o schema conhecido usado pelo Gemini para gerar SQL."""
    return KNOWN_SCHEMA_CONTEXT


def _clean_sql(sql: str) -> str:
    cleaned = (sql or "").strip()
    cleaned = re.sub(r"^```(?:sql)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned).strip()
    cleaned = re.sub(r"^sql\s*:\s*", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if cleaned.endswith(";") and cleaned.count(";") == 1:
        cleaned = cleaned[:-1].strip()
    return cleaned


def _has_middle_semicolon(sql: str) -> bool:
    if ";" not in sql:
        return False
    return not sql.endswith(";") or sql.count(";") > 1


def _contains_prohibited_word(sql_lower: str) -> str | None:
    for word in PROHIBITED_SQL_WORDS:
        if re.search(rf"\b{re.escape(word)}\b", sql_lower):
            return word.upper()
    return None


def _is_simple_select_without_limit(sql_lower: str) -> bool:
    if not sql_lower.startswith("select") or " limit " in f" {sql_lower} ":
        return False
    if " from " not in f" {sql_lower} ":
        return False
    complex_markers = (
        " join ",
        " where ",
        " group by ",
        " order by ",
        " having ",
        " union ",
        " intersect ",
        " except ",
        "sum(",
        "count(",
        "avg(",
        "min(",
        "max(",
        " jsonb",
    )
    return not any(marker in sql_lower for marker in complex_markers)


def limpar_sql_gerada(sql: str) -> str:
    """Remove markdown e espaços extras da SQL gerada pelo Gemini."""
    return _clean_sql(sql)


def validar_sql_somente_leitura(sql: str) -> str:
    """Valida localmente que a SQL é apenas leitura e normaliza quando seguro."""
    cleaned = limpar_sql_gerada(sql)
    if not cleaned:
        raise SQLSafetyError("Não consegui gerar uma consulta SQL segura para essa pergunta.")

    if _has_middle_semicolon(cleaned):
        raise SQLSafetyError("Consulta bloqueada: múltiplas instruções ou ponto e vírgula no meio não são permitidos.")

    lowered = cleaned.lower().strip()
    if any(marker in lowered for marker in COMMENT_MARKERS):
        raise SQLSafetyError("Consulta bloqueada: comentários SQL não são permitidos.")

    if not (lowered.startswith("select") or lowered.startswith("with")):
        raise SQLSafetyError("Consulta bloqueada: apenas SELECT ou WITH são permitidos.")

    prohibited = _contains_prohibited_word(lowered)
    if prohibited:
        raise SQLSafetyError(f"Consulta bloqueada: comando {prohibited} não é permitido.")

    # Só adiciona LIMIT automaticamente em SELECT simples; agregações ficam como o usuário pediu.
    if _is_simple_select_without_limit(lowered):
        cleaned = f"{cleaned} LIMIT 100"

    logger.info("SQL validada somente leitura: %s", cleaned)
    return cleaned


def executar_select_seguro(sql: str) -> list[dict[str, Any]]:
    """Executa a SQL validada via RPC read-only do Supabase."""
    rows = executar_select(sql)
    logger.info("Quantidade de linhas retornadas pela consulta segura: %s", len(rows))
    return rows


def _usuario_pediu_sql(pergunta: str) -> bool:
    lower = pergunta.lower()
    return any(term in lower for term in ("mostre a sql", "mostrar sql", "qual sql", "detalhes técnicos", "detalhes tecnicos"))


def responder_pergunta_banco(pergunta: str) -> str:
    """Responde pergunta livre sobre o banco usando no máximo 2 tentativas de SQL."""
    schema_context = listar_schema_disponivel()
    last_error = ""
    sql_validada = ""
    resultado: list[dict[str, Any]] = []

    logger.info("Pergunta recebida pelo database_agent: %s", pergunta)

    for attempt in range(1, MAX_SQL_ATTEMPTS + 1):
        sql_gerada = gerar_sql(pergunta, schema_context, erro_anterior=last_error, sql_anterior=sql_validada)
        logger.info("SQL gerada pelo Gemini na tentativa %s: %s", attempt, sql_gerada)

        try:
            sql_validada = validar_sql_somente_leitura(sql_gerada)
            resultado = executar_select_seguro(sql_validada)
            break
        except SQLSafetyError as exc:
            logger.warning("SQL bloqueada por segurança na tentativa %s: %s", attempt, exc)
            return str(exc)
        except RuntimeError as exc:
            last_error = str(exc)
            logger.warning("Falha ao executar SQL na tentativa %s: %s", attempt, last_error)
            if "executar_select_somente_leitura" in last_error:
                return "Para ativar a IA livre do banco, falta criar a função RPC executar_select_somente_leitura no Supabase."
            if attempt >= MAX_SQL_ATTEMPTS:
                return f"Não consegui consultar o banco agora. Erro: {last_error}"

    resposta = gerar_resposta_final(pergunta, sql_validada, resultado, mostrar_sql=_usuario_pediu_sql(pergunta))
    if not resposta.strip():
        if not resultado:
            return "Não encontrei registros para essa pergunta."
        preview = json.dumps(resultado[:10], ensure_ascii=False, default=str, indent=2)
        return f"Encontrei {len(resultado)} registro(s), mas não consegui gerar o resumo agora.\n{preview}"
    return resposta
