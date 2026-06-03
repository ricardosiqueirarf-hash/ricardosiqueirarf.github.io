"""Camada de acesso ao Supabase para pedidos, orçamentos e estado de conversa."""
from __future__ import annotations

from copy import deepcopy
from typing import Any, TYPE_CHECKING

from config import get_settings

if TYPE_CHECKING:
    from supabase import Client
else:
    Client = Any

_memory_conversation_states: dict[str, dict[str, Any]] = {}
_supabase_client: Client | None = None


def get_supabase_client() -> Client:
    global _supabase_client
    if _supabase_client is None:
        from supabase import create_client

        settings = get_settings()
        _supabase_client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _supabase_client


def _execute_select(table: str, query_builder: Any) -> list[dict[str, Any]]:
    try:
        response = query_builder.execute()
        return response.data or []
    except Exception as exc:  # Supabase SDK encapsula falhas HTTP/DB em exceções genéricas.
        raise RuntimeError("Não consegui consultar o Supabase agora. Tente novamente em instantes.") from exc


def buscar_pedido_por_numero(numero: str | int) -> dict[str, Any] | None:
    settings = get_settings()
    try:
        client = get_supabase_client()
    except Exception as exc:
        raise RuntimeError("Não consegui conectar ao Supabase agora. Verifique a configuração e tente novamente.") from exc
    data = _execute_select(
        settings.pedidos_table,
        client.table(settings.pedidos_table).select("*").eq("pedido", str(numero)).limit(1),
    )
    return data[0] if data else None


def buscar_pedidos_por_cliente(nome: str) -> list[dict[str, Any]]:
    settings = get_settings()
    try:
        client = get_supabase_client()
    except Exception as exc:
        raise RuntimeError("Não consegui conectar ao Supabase agora. Verifique a configuração e tente novamente.") from exc
    return _execute_select(
        settings.pedidos_table,
        client.table(settings.pedidos_table).select("*").ilike("cliente", f"%{nome}%").limit(10),
    )


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
