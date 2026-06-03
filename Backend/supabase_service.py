"""Camada de acesso ao Supabase para pedidos, orçamentos e estado de conversa."""
from __future__ import annotations

import logging
from copy import deepcopy
from typing import Any, TYPE_CHECKING

from config import get_settings

if TYPE_CHECKING:
    from supabase import Client
else:
    Client = Any

logger = logging.getLogger(__name__)

_memory_conversation_states: dict[str, dict[str, Any]] = {}
_supabase_client: Client | None = None


def get_supabase_client() -> Client:
    global _supabase_client
    if _supabase_client is None:
        from supabase import create_client

        settings = get_settings()
        _supabase_client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _supabase_client


def _execute_select(query_builder: Any) -> list[dict[str, Any]]:
    try:
        response = query_builder.execute()
        return response.data or []
    except Exception as exc:  # Supabase SDK encapsula falhas HTTP/DB em exceções genéricas.
        logger.exception("Falha ao consultar Supabase: %s", exc)
        raise RuntimeError("Não consegui consultar o Supabase agora. Tente novamente em instantes.") from exc


def _unique_values(values: list[str | None]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for value in values:
        normalized = str(value or "").strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            unique.append(normalized)
    return unique


def _is_schema_mismatch_error(exc: Exception) -> bool:
    """Identifica erros esperados ao testar tabelas/colunas alternativas."""
    text = str(exc).lower()
    schema_markers = (
        "could not find",
        "schema cache",
        "does not exist",
        "column",
        "relation",
        "table",
        "pgrst",
    )
    return any(marker in text for marker in schema_markers)


def _select_first_by_column(table: str, column: str, value: str | int) -> dict[str, Any] | None:
    client = get_supabase_client()
    try:
        response = client.table(table).select("*").eq(column, str(value)).limit(1).execute()
        data = response.data or []
        return data[0] if data else None
    except Exception as exc:
        if _is_schema_mismatch_error(exc):
            logger.info("Tentativa de consulta falhou em %s.%s=%s: %s", table, column, value, exc)
            return None
        logger.exception("Falha real ao consultar Supabase em %s.%s=%s: %s", table, column, value, exc)
        raise RuntimeError("Não consegui consultar o Supabase agora. Tente novamente em instantes.") from exc


def _select_many_by_column_ilike(table: str, column: str, value: str, limit: int = 10) -> list[dict[str, Any]] | None:
    client = get_supabase_client()
    try:
        response = client.table(table).select("*").ilike(column, f"%{value}%").limit(limit).execute()
        return response.data or []
    except Exception as exc:
        if _is_schema_mismatch_error(exc):
            logger.info("Tentativa de consulta por cliente falhou em %s.%s ilike %s: %s", table, column, value, exc)
            return None
        logger.exception("Falha real ao consultar Supabase por cliente em %s.%s=%s: %s", table, column, value, exc)
        raise RuntimeError("Não consegui consultar o Supabase agora. Tente novamente em instantes.") from exc


def _pedido_tables() -> list[str]:
    settings = get_settings()
    # No sistema atual da ColorGlass, pedido/orçamento fica na tabela orcamentos
    # e o número fica em numero_pedido. Mantemos pedidos_table para compatibilidade.
    return _unique_values([settings.pedidos_table, settings.orcamentos_table, "orcamentos", "pedidos"])


def buscar_pedido_por_numero(numero: str | int) -> dict[str, Any] | None:
    try:
        get_supabase_client()
    except Exception as exc:
        raise RuntimeError("Não consegui conectar ao Supabase agora. Verifique a configuração e tente novamente.") from exc

    # Colunas mais prováveis primeiro. A aplicação existente usa numero_pedido.
    candidate_columns = ["numero_pedido", "pedido", "numero", "id"]
    for table in _pedido_tables():
        for column in candidate_columns:
            pedido = _select_first_by_column(table, column, numero)
            if pedido:
                pedido.setdefault("_supabase_table", table)
                pedido.setdefault("_matched_column", column)
                return pedido

    return None


def buscar_pedidos_por_cliente(nome: str) -> list[dict[str, Any]]:
    try:
        get_supabase_client()
    except Exception as exc:
        raise RuntimeError("Não consegui conectar ao Supabase agora. Verifique a configuração e tente novamente.") from exc

    candidate_columns = ["cliente_nome", "cliente", "nome_cliente"]
    for table in _pedido_tables():
        for column in candidate_columns:
            pedidos = _select_many_by_column_ilike(table, column, nome)
            if pedidos is not None:
                for pedido in pedidos:
                    pedido.setdefault("_supabase_table", table)
                    pedido.setdefault("_matched_column", column)
                return pedidos

    raise RuntimeError("Não consegui consultar o Supabase agora. Tente novamente em instantes.")


def salvar_orcamento(dados: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    try:
        client = get_supabase_client()
    except Exception as exc:
        raise RuntimeError("Não consegui conectar ao Supabase agora. Verifique a configuração e tente novamente.") from exc
    try:
        response = client.table(settings.orcamentos_table).insert(dados).execute()
        saved = response.data or []
        return saved[0] if saved else dados
    except Exception as exc:
        logger.exception("Falha ao salvar orçamento no Supabase: %s", exc)
        raise RuntimeError("Não consegui salvar o orçamento no Supabase agora. Tente novamente.") from exc


def salvar_estado_conversa(chat_id: str | int, estado: dict[str, Any]) -> None:
    """Salva estado. Se a tabela não existir/falhar, usa fallback em memória bem isolado."""
    key = str(chat_id)
    settings = get_settings(validate=False)
    if not settings.supabase_url or not settings.supabase_service_role_key:
        _memory_conversation_states[key] = deepcopy(estado)
        return

    try:
        client = get_supabase_client()
        client.table(settings.conversation_state_table).upsert(
            {"chat_id": key, "state": estado}, on_conflict="chat_id"
        ).execute()
    except Exception:
        logger.info("Usando fallback em memória para salvar estado do chat %s", key)
        _memory_conversation_states[key] = deepcopy(estado)


def carregar_estado_conversa(chat_id: str | int) -> dict[str, Any] | None:
    key = str(chat_id)
    settings = get_settings(validate=False)
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return deepcopy(_memory_conversation_states.get(key))

    try:
        client = get_supabase_client()
        response = (
            client.table(settings.conversation_state_table)
            .select("state")
            .eq("chat_id", key)
            .limit(1)
            .execute()
        )
        data = response.data or []
        if data:
            return data[0].get("state")
    except Exception:
        return deepcopy(_memory_conversation_states.get(key))

    return deepcopy(_memory_conversation_states.get(key))


def limpar_estado_conversa(chat_id: str | int) -> None:
    key = str(chat_id)
    _memory_conversation_states.pop(key, None)
    settings = get_settings(validate=False)
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return

    try:
        client = get_supabase_client()
        client.table(settings.conversation_state_table).delete().eq("chat_id", key).execute()
    except Exception:
        pass
