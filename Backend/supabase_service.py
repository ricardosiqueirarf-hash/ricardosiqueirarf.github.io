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

# Modo somente leitura: o bot pode consultar dados, mas não altera o Supabase.
# Isso garante que a IA e o fluxo do Telegram não tenham autonomia para inserir,
# atualizar, fazer upsert ou deletar registros no banco enquanto este modo estiver ativo.
DATABASE_READ_ONLY = True

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
    safe_limit = max(1, min(int(limit or 10), 300))
    try:
        response = client.table(table).select("*").ilike(column, f"%{value}%").limit(safe_limit).execute()
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
            pedidos = _select_many_by_column_ilike(table, column, nome, limit=300)
            if pedidos is not None:
                for pedido in pedidos:
                    pedido.setdefault("_supabase_table", table)
                    pedido.setdefault("_matched_column", column)
                return pedidos

    raise RuntimeError("Não consegui consultar o Supabase agora. Tente novamente em instantes.")


def listar_tabelas_leitura() -> list[str]:
    """Lista tabelas informativas configuradas; não é whitelist restritiva."""
    settings = get_settings()
    return list(settings.supabase_read_tables)


def _ensure_read_table_allowed(table: str) -> str:
    """Normaliza tabela sem bloquear: service role + RPC/read-only controlam o acesso real."""
    normalized = str(table or "").strip()
    if not normalized:
        raise RuntimeError("Informe uma tabela para visualização.")
    return normalized


def consultar_tabela_somente_leitura(table: str, limit: int = 300) -> list[dict[str, Any]]:
    """Consulta genérica somente leitura sem whitelist restritiva."""
    safe_table = _ensure_read_table_allowed(table)
    safe_limit = max(1, min(int(limit or 300), 300))
    try:
        client = get_supabase_client()
    except Exception as exc:
        raise RuntimeError("Não consegui conectar ao Supabase agora. Verifique a configuração e tente novamente.") from exc

    try:
        response = client.table(safe_table).select("*").limit(safe_limit).execute()
        return response.data or []
    except Exception as exc:
        logger.exception("Falha ao visualizar tabela %s no Supabase: %s", safe_table, exc)
        raise RuntimeError(f"Não consegui visualizar a tabela {safe_table} agora.") from exc


def consultar_tabela_por_termo_somente_leitura(
    table: str,
    column: str,
    term: str,
    limit: int = 300,
) -> list[dict[str, Any]]:
    """Consulta somente leitura com ilike em coluna específica, sem whitelist restritiva."""
    safe_table = _ensure_read_table_allowed(table)
    safe_limit = max(1, min(int(limit or 300), 300))
    try:
        client = get_supabase_client()
    except Exception as exc:
        raise RuntimeError("Não consegui conectar ao Supabase agora. Verifique a configuração e tente novamente.") from exc

    try:
        response = client.table(safe_table).select("*").ilike(column, f"%{term}%").limit(safe_limit).execute()
        return response.data or []
    except Exception as exc:
        if _is_schema_mismatch_error(exc):
            logger.info("Coluna %s não disponível para filtro em %s: %s", column, safe_table, exc)
            return []
        logger.exception("Falha ao visualizar tabela %s filtrando %s: %s", safe_table, column, exc)
        raise RuntimeError(f"Não consegui visualizar a tabela {safe_table} agora.") from exc


def salvar_orcamento(dados: dict[str, Any]) -> dict[str, Any]:
    """Bloqueia escrita de orçamento no Supabase enquanto o bot estiver somente leitura."""
    if DATABASE_READ_ONLY:
        logger.info("Salvamento de orçamento bloqueado: bot em modo somente leitura.")
        raise RuntimeError(
            "Modo somente leitura ativo: posso consultar pedidos, mas ainda não posso salvar orçamentos no Supabase."
        )

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
    """Salva estado somente em memória para não alterar o Supabase."""
    key = str(chat_id)
    _memory_conversation_states[key] = deepcopy(estado)

    if DATABASE_READ_ONLY:
        logger.info("Estado do chat %s mantido apenas em memória: bot em modo somente leitura.", key)
        return


def carregar_estado_conversa(chat_id: str | int) -> dict[str, Any] | None:
    """Carrega estado apenas da memória local para evitar leituras/escritas na tabela de estado."""
    key = str(chat_id)
    return deepcopy(_memory_conversation_states.get(key))


def limpar_estado_conversa(chat_id: str | int) -> None:
    """Limpa estado somente da memória local, sem deletar nada no Supabase."""
    key = str(chat_id)
    _memory_conversation_states.pop(key, None)
    logger.info("Estado do chat %s removido apenas da memória local.", key)


def executar_select(sql: str) -> list[dict[str, Any]]:
    """Executa SELECT via RPC executar_select_somente_leitura no Supabase."""
    try:
        client = get_supabase_client()
    except Exception as exc:
        raise RuntimeError("Não consegui conectar ao Supabase agora. Verifique a configuração e tente novamente.") from exc

    try:
        response = client.rpc("executar_select_somente_leitura", {"sql": sql}).execute()
        data = response.data or []
        return list(data) if isinstance(data, list) else [data]
    except Exception as exc:
        text = str(exc).lower()
        if "executar_select_somente_leitura" in text or "function" in text or "rpc" in text or "pgrst202" in text:
            raise RuntimeError(
                "Para ativar a IA livre do banco, falta criar a função RPC executar_select_somente_leitura no Supabase."
            ) from exc
        logger.exception("Falha ao executar SELECT via RPC somente leitura: %s", exc)
        raise RuntimeError(f"Não consegui executar a consulta somente leitura no Supabase. Detalhe: {exc}") from exc


def executar_sql_select_via_rpc(sql: str) -> list[dict[str, Any]]:
    """Compatibilidade: delega para executar_select."""
    return executar_select(sql)


def consultar_schema_publico() -> list[dict[str, Any]]:
    """Consulta information_schema para descobrir tabelas/colunas públicas dinamicamente."""
    schema_sql = """
SELECT
  table_schema AS schema,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_schema, table_name, ordinal_position
LIMIT 300
""".strip()
    return executar_select(schema_sql)

