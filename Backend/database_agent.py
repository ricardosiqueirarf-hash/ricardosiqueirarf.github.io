"""Agente read-only para perguntas livres sobre o banco da ColorGlass.

Este módulo transforma perguntas naturais em consultas SQL SELECT validadas,
executa a consulta por RPC segura no Supabase e resume o resultado em português.
Nenhuma função deste arquivo executa comandos de escrita.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from config import get_settings
from gemini_service import gerar_sql_somente_leitura_com_gemini, responder_com_dados
from supabase_service import executar_sql_select_via_rpc, listar_tabelas_leitura

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

SENSITIVE_MARKERS = (
    "senha",
    "password",
    "token",
    "secret",
    "service_role",
    "authorization",
    "apikey",
    "api_key",
    "key",
    "chave",
)

COMMENT_MARKERS = ("--", "/*", "*/", "#")


class SQLSafetyError(ValueError):
    """Erro levantado quando uma SQL não passa na validação somente leitura."""


def _contains_prohibited_word(sql_lower: str) -> str | None:
    for word in PROHIBITED_SQL_WORDS:
        if re.search(rf"\b{re.escape(word)}\b", sql_lower):
            return word.upper()
    return None


def _contains_sensitive_marker(text: str) -> str | None:
    lower = text.lower()
    for marker in SENSITIVE_MARKERS:
        if marker in lower:
            return marker
    return None


def _strip_single_trailing_semicolon(sql: str) -> str:
    stripped = sql.strip()
    if stripped.endswith(";"):
        stripped = stripped[:-1].strip()
    return stripped


def _has_middle_semicolon(sql: str) -> bool:
    stripped = sql.strip()
    if ";" not in stripped:
        return False
    return not stripped.endswith(";") or stripped.count(";") > 1


def _apply_limit(sql: str) -> str:
    settings = get_settings()
    default_limit = min(settings.database_agent_default_limit, settings.database_agent_max_rows, 50)
    max_rows = min(settings.database_agent_max_rows, 50)
    limit_pattern = re.compile(r"\blimit\s+(\d+)\b", re.IGNORECASE)
    match = limit_pattern.search(sql)
    if not match:
        return f"{sql} LIMIT {default_limit}"

    current_limit = int(match.group(1))
    if current_limit <= max_rows:
        return sql

    return limit_pattern.sub(f"LIMIT {max_rows}", sql, count=1)


def _redact_sensitive(value: Any, key: str = "") -> Any:
    if _contains_sensitive_marker(key):
        return "[oculto]"
    if isinstance(value, dict):
        return {k: _redact_sensitive(v, k) for k, v in value.items() if not _contains_sensitive_marker(k)}
    if isinstance(value, list):
        return [_redact_sensitive(item) for item in value]
    return value


def listar_schema_disponivel() -> str:
    """Monta contexto de schema permitido para o Gemini.

    A lista de tabelas vem de SUPABASE_READ_TABLES. As colunas são descobertas por
    uma RPC somente leitura quando disponível; se a RPC ainda não existir, retorna
    ao menos a lista de tabelas autorizadas para que o erro final seja claro.
    """
    tables = listar_tabelas_leitura()
    if not tables:
        return "Nenhuma tabela liberada em SUPABASE_READ_TABLES."

    table_list = ", ".join(f"'{table}'" for table in tables)
    schema_sql = f"""
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ({table_list})
ORDER BY table_name, ordinal_position
LIMIT 50
""".strip()

    try:
        rows = executar_sql_select_via_rpc(schema_sql)
    except RuntimeError as exc:
        logger.info("Schema detalhado indisponível via RPC: %s", exc)
        return "Tabelas liberadas para leitura: " + ", ".join(tables)

    grouped: dict[str, list[str]] = {table: [] for table in tables}
    for row in rows:
        table_name = str(row.get("table_name") or "")
        column_name = str(row.get("column_name") or "")
        data_type = str(row.get("data_type") or "")
        if table_name in grouped and column_name:
            grouped[table_name].append(f"{column_name} ({data_type})")

    lines = ["Schema liberado para consultas somente leitura:"]
    for table in tables:
        columns = grouped.get(table) or []
        if columns:
            lines.append(f"- {table}: {', '.join(columns)}")
        else:
            lines.append(f"- {table}: colunas não descobertas")
    return "\n".join(lines)


def gerar_sql_somente_leitura(user_message: str, schema_context: str) -> str:
    """Pede ao Gemini uma SQL SELECT usando somente o schema permitido."""
    sql = gerar_sql_somente_leitura_com_gemini(user_message, schema_context)
    logger.info("SQL gerada pelo Gemini: %s", sql)
    return sql.strip()


def validar_sql_somente_leitura(sql: str) -> str:
    """Valida, normaliza e limita uma SQL para permitir apenas leitura."""
    if not sql or not sql.strip():
        raise SQLSafetyError("Não consegui gerar uma consulta segura para essa pergunta.")

    cleaned = sql.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:sql)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned).strip()

    if _has_middle_semicolon(cleaned):
        raise SQLSafetyError("Consulta bloqueada por segurança: múltiplas instruções ou ponto e vírgula no meio.")

    cleaned = _strip_single_trailing_semicolon(cleaned)
    lowered = cleaned.lower()

    if any(marker in lowered for marker in COMMENT_MARKERS):
        raise SQLSafetyError("Consulta bloqueada por segurança: comentários SQL não são permitidos.")

    if not (lowered.startswith("select") or lowered.startswith("with")):
        raise SQLSafetyError("Consulta bloqueada por segurança: apenas SELECT ou WITH são permitidos.")

    prohibited = _contains_prohibited_word(lowered)
    if prohibited:
        raise SQLSafetyError(f"Consulta bloqueada por segurança: comando {prohibited} não é permitido.")

    sensitive = _contains_sensitive_marker(lowered)
    if sensitive:
        raise SQLSafetyError(f"Consulta bloqueada por segurança: campo sensível '{sensitive}' não pode ser consultado.")

    safe_sql = _apply_limit(cleaned)
    logger.info("SQL validada somente leitura: %s", safe_sql)
    return safe_sql


def executar_select_seguro(sql: str) -> list[dict[str, Any]]:
    """Executa SQL já validada por RPC read-only e redige qualquer campo sensível."""
    rows = executar_sql_select_via_rpc(sql)
    safe_rows = _redact_sensitive(rows)
    logger.info("Quantidade de linhas retornadas pela consulta segura: %s", len(safe_rows))
    return safe_rows


def responder_pergunta_banco(user_message: str) -> str:
    """Fluxo completo da IA livre do banco em modo somente leitura."""
    settings = get_settings()
    if not settings.database_agent_allowed:
        return "A IA livre do banco está desativada neste ambiente."

    logger.info("Pergunta recebida pelo database_agent: %s", user_message)

    if "quais tabelas" in user_message.lower() or "tabelas existem" in user_message.lower():
        return listar_schema_disponivel()

    schema_context = listar_schema_disponivel()
    try:
        generated_sql = gerar_sql_somente_leitura(user_message, schema_context)
        safe_sql = validar_sql_somente_leitura(generated_sql)
        rows = executar_select_seguro(safe_sql)
    except SQLSafetyError as exc:
        logger.warning("SQL bloqueada por segurança: %s", exc)
        return str(exc)
    except RuntimeError as exc:
        message = str(exc)
        logger.warning("Falha ao executar pergunta livre do banco: %s", message)
        if "executar_select_somente_leitura" in message:
            return "Para ativar a IA livre do banco, falta criar a função RPC executar_select_somente_leitura no Supabase."
        return message

    context = {
        "pergunta": user_message,
        "sql_executada": safe_sql,
        "quantidade_linhas": len(rows),
        "resultado": rows[: settings.database_agent_max_rows],
    }
    answer = responder_com_dados(user_message, context)
    if "não consegui gerar" in answer.lower():
        preview = json.dumps(context, ensure_ascii=False, default=str, indent=2)
        if len(preview) > 3000:
            preview = preview[:3000] + "..."
        return f"Consulta executada em modo somente leitura.\nSQL: {safe_sql}\nResultado:\n{preview}"
    return answer
