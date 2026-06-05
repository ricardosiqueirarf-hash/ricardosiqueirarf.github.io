"""Agente analista read-only para perguntas livres sobre o banco da ColorGlass."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from config import get_settings
from gemini_service import gerar_resposta_final, gerar_sql
from supabase_service import consultar_schema_publico, executar_select

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

FALLBACK_SCHEMA_CONTEXT = """
Fallback de schema conhecido da ColorGlass, usado somente quando o schema dinâmico falha.
Acesso permitido: visualização total, apenas SELECT/WITH, sem comandos de escrita.

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

Tabela estoque: id int8, produto text, quantidade numeric, unidade text, data_contagem timestamptz, custo numeric, categoria text.
Tabela materiais: id int8, nome text, custo numeric, tipo_medida text, margem numeric, preco numeric, perda numeric, tag text.
Tabela orcamentos: id uuid, data_criacao timestamptz, cliente_nome text, numero_pedido numeric, quantidade_total numeric, valor_total numeric, userid text, lojaid text, status numeric, data_aprovacao timestamptz, valor_pago jsonb.
Tabela pagamentos: id int8, created_at timestamptz, orcamentoid uuid, valor numeric, forma_pagamento text.
Tabela perfis: id uuid, nome text, custo numeric, margem numeric, perda numeric, preco numeric, tipologias text, insumos text, tags text.
Tabela portas: id int8, tipo text, dados text, preco numeric, svg text, quantidade numeric, orcamento_uuid uuid, lojaid text.
Tabela puxadores: id int8, nome text, custo numeric, tipo_medida text, margem numeric, preco numeric, perda numeric, insumos jsonb.
Tabela vidros: id uuid, tipo text, espessura numeric, custo numeric, margem numeric, perda numeric, preco numeric, tags text.
Tabela usuarios: userid uuid, pass text, user text, token text, storeid uuid, level numeric, dados jsonb, nome text.

Relações úteis:
- pagamentos.orcamentoid referencia orcamentos.id.
- portas.orcamento_uuid referencia orcamentos.id.
- orcamentos.userid pode se relacionar com usuarios.userid.
- orcamentos.lojaid pode se relacionar com usuarios.storeid quando aplicável.
""".strip()


class SQLSafetyError(ValueError):
    """Erro levantado quando uma SQL não passa na validação somente leitura."""


def _formatar_schema_dinamico(rows: list[dict[str, Any]]) -> str:
    grouped: dict[tuple[str, str], list[str]] = {}
    for row in rows:
        schema = str(row.get("schema") or row.get("table_schema") or "public")
        table = str(row.get("table_name") or "")
        column = str(row.get("column_name") or "")
        data_type = str(row.get("data_type") or "")
        if table and column:
            grouped.setdefault((schema, table), []).append(f"{column} {data_type}".strip())

    if not grouped:
        raise RuntimeError("Schema dinâmico retornou vazio.")

    lines = [
        "Schema dinâmico real do Supabase/Postgres da ColorGlass.",
        "Acesso permitido: visualização total de todas as tabelas/colunas listadas, apenas SELECT/WITH.",
        "Use schema public salvo se a pergunta exigir qualificação explícita.",
        "",
        "Tabelas e colunas disponíveis:",
    ]
    for (schema, table), columns in sorted(grouped.items()):
        lines.append(f"- {schema}.{table}: {', '.join(columns)}")
    return "\n".join(lines)


def listar_schema_disponivel() -> str:
    """Retorna schema dinâmico do Supabase; usa fallback manual se a RPC falhar."""
    try:
        rows = consultar_schema_publico()
        schema_context = _formatar_schema_dinamico(rows)
        logger.info("Schema dinâmico carregado com %s coluna(s).", len(rows))
        return schema_context
    except Exception as exc:
        logger.warning("Falha ao carregar schema dinâmico; usando fallback manual: %s", exc)
        return FALLBACK_SCHEMA_CONTEXT


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


def _apply_limit(sql: str) -> str:
    settings = get_settings()
    max_rows = min(settings.database_agent_max_rows, 300)
    default_limit = min(settings.database_agent_default_limit, max_rows)
    limit_pattern = re.compile(r"\blimit\s+(\d+)\b", re.IGNORECASE)
    match = limit_pattern.search(sql)
    if not match:
        return f"{sql} LIMIT {default_limit}"

    current_limit = int(match.group(1))
    if current_limit <= max_rows:
        return sql
    return limit_pattern.sub(f"LIMIT {max_rows}", sql, count=1)


def limpar_sql_gerada(sql: str) -> str:
    """Remove markdown e espaços extras da SQL gerada pelo Gemini."""
    return _clean_sql(sql)


def validar_sql_somente_leitura(sql: str) -> str:
    """Valida localmente que a SQL é apenas leitura e aplica LIMIT máximo 300."""
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

    limited_sql = _apply_limit(cleaned)
    logger.info("SQL validada somente leitura: %s", limited_sql)
    return limited_sql


def executar_select_seguro(sql: str) -> list[dict[str, Any]]:
    """Executa a SQL validada via RPC read-only do Supabase."""
    rows = executar_select(sql)
    logger.info("Quantidade de linhas retornadas pela consulta segura: %s", len(rows))
    return rows[: min(get_settings().database_agent_max_rows, 300)]


def _usuario_pediu_sql(pergunta: str) -> bool:
    lower = pergunta.lower()
    return any(term in lower for term in ("mostre a sql", "mostrar sql", "qual sql", "detalhes técnicos", "detalhes tecnicos"))


def _normalizar_texto(texto: str) -> str:
    replacements = str.maketrans({
        "á": "a", "à": "a", "â": "a", "ã": "a",
        "é": "e", "ê": "e",
        "í": "i",
        "ó": "o", "ô": "o", "õ": "o",
        "ú": "u",
        "ç": "c",
    })
    return texto.lower().translate(replacements)


def _is_pergunta_capacidade(pergunta: str) -> bool:
    lower = _normalizar_texto(pergunta)
    return any(term in lower for term in ("tem acesso", "voce acessa", "consegue acessar")) and any(
        term in lower for term in ("banco", "dados", "supabase", "tabelas")
    )


def _responder_capacidade_banco() -> str:
    return (
        "Sim. Tenho acesso somente leitura ao banco da ColorGlass via Supabase. "
        "Posso consultar tabelas, pedidos, pagamentos, estoque, materiais, perfis, vidros, puxadores, trilhos, "
        "clientes/usuários, status, faturamento e rankings. Eu gero apenas consultas SELECT/WITH, valido a SQL "
        "antes de executar e não tenho permissão no código para alterar dados."
    )


def _extrair_termo_codigo(lower: str) -> str | None:
    match = re.search(r"\b\d{2,}\b", lower)
    return match.group(0) if match else None


def _deve_usar_sql_fallback_prioritario(pergunta: str) -> bool:
    """Usa SQL determinística antes do Gemini para perguntas objetivas conhecidas."""
    lower = _normalizar_texto(pergunta)
    has_lookup_word = any(term in lower for term in ("preco", "valor", "custo", "procure", "procurar", "busque", "buscar", "pesquise"))
    has_known_table = any(term in lower for term in ("perfil", "perfis", "material", "materiais", "estoque"))
    has_code = _extrair_termo_codigo(lower) is not None
    return has_lookup_word and (has_known_table or has_code)


def _gerar_sql_fallback(pergunta: str) -> str:
    """Fallback determinístico quando Gemini não retorna SQL."""
    lower = _normalizar_texto(pergunta)
    limit = min(get_settings().database_agent_default_limit, get_settings().database_agent_max_rows, 300)

    if "faturamento" in lower or "faturei" in lower or "receita" in lower:
        if "mes" in lower:
            return (
                "SELECT COALESCE(SUM(valor_total), 0) AS faturamento_mes "
                "FROM orcamentos "
                "WHERE data_aprovacao >= date_trunc('month', now())"
            )
        return "SELECT COALESCE(SUM(valor_total), 0) AS faturamento_total FROM orcamentos"

    if "ultimo pedido" in lower or "ultimos pedidos" in lower or "ultimos orcamentos" in lower or "ultimos orçamentos" in lower:
        return f"SELECT * FROM orcamentos ORDER BY data_criacao DESC LIMIT {limit}"

    if "saldo aberto" in lower or "devendo" in lower or "devedores" in lower or "inadimpl" in lower:
        return f"""
SELECT
  o.id,
  o.numero_pedido,
  o.cliente_nome,
  o.valor_total,
  COALESCE(SUM(p.valor), 0) AS total_pago,
  o.valor_total - COALESCE(SUM(p.valor), 0) AS saldo_aberto
FROM orcamentos o
LEFT JOIN pagamentos p ON p.orcamentoid = o.id
GROUP BY o.id, o.numero_pedido, o.cliente_nome, o.valor_total
HAVING o.valor_total > COALESCE(SUM(p.valor), 0)
ORDER BY saldo_aberto DESC
LIMIT {limit}
""".strip()

    if "valor total" in lower and "estoque" in lower:
        return "SELECT COALESCE(SUM(quantidade * custo), 0) AS valor_total_estoque FROM estoque"

    if "estoque" in lower:
        return f"""
SELECT
  produto,
  quantidade,
  unidade,
  custo,
  quantidade * custo AS valor_total
FROM estoque
ORDER BY valor_total DESC
LIMIT {limit}
""".strip()

    if any(term in lower for term in ("preco", "valor", "custo", "procure", "procurar", "busque", "buscar", "pesquise")):
        codigo = _extrair_termo_codigo(lower)
        bronze_filter = ""
        if "bronze" in lower:
            bronze_filter = " AND (nome ILIKE '%bronze%' OR tags ILIKE '%bronze%' OR tipologias ILIKE '%bronze%' OR insumos ILIKE '%bronze%')"
        if codigo:
            return f"""
SELECT
  id,
  nome,
  custo,
  margem,
  perda,
  preco,
  tipologias,
  insumos,
  tags
FROM perfis
WHERE (nome ILIKE '%{codigo}%' OR tags ILIKE '%{codigo}%' OR tipologias ILIKE '%{codigo}%' OR insumos ILIKE '%{codigo}%')
{bronze_filter}
ORDER BY nome
LIMIT {limit}
""".strip()
        if "perfil" in lower or "perfis" in lower:
            return f"SELECT * FROM perfis ORDER BY nome LIMIT {limit}"
        if "material" in lower or "materiais" in lower:
            return f"SELECT * FROM materiais ORDER BY nome LIMIT {limit}"

    table_map = {
        "orcamento": "orcamentos",
        "orcamentos": "orcamentos",
        "pedido": "orcamentos",
        "pedidos": "orcamentos",
        "pagamento": "pagamentos",
        "pagamentos": "pagamentos",
        "perfil": "perfis",
        "perfis": "perfis",
        "material": "materiais",
        "materiais": "materiais",
        "porta": "portas",
        "portas": "portas",
        "vidro": "vidros",
        "vidros": "vidros",
        "puxador": "puxadores",
        "puxadores": "puxadores",
        "trilho": "trilhos",
        "trilhos": "trilhos",
        "usuario": "usuarios",
        "usuarios": "usuarios",
        "tag": "tags",
        "tags": "tags",
    }
    for keyword, table in table_map.items():
        if keyword in lower:
            return f"SELECT * FROM {table} LIMIT {limit}"

    return ""


def responder_pergunta_banco(pergunta: str) -> str:
    """Responde pergunta livre sobre o banco usando schema dinâmico e até 2 tentativas de SQL."""
    settings = get_settings()
    if not settings.database_agent_allowed:
        return "O agente do banco está desativado neste ambiente."

    if _is_pergunta_capacidade(pergunta):
        return _responder_capacidade_banco()

    schema_context = listar_schema_disponivel()
    if "quais tabelas" in pergunta.lower() or "tabelas existem" in pergunta.lower():
        return schema_context

    last_error = ""
    sql_validada = ""
    resultado: list[dict[str, Any]] = []

    logger.info("Pergunta recebida pelo database_agent: %s", pergunta)

    usar_fallback_prioritario = _deve_usar_sql_fallback_prioritario(pergunta)

    for attempt in range(1, MAX_SQL_ATTEMPTS + 1):
        sql_gerada = ""
        if usar_fallback_prioritario and attempt == 1:
            sql_gerada = _gerar_sql_fallback(pergunta)
            logger.info("SQL fallback local prioritário na tentativa %s: %s", attempt, sql_gerada)
        else:
            sql_gerada = gerar_sql(pergunta, schema_context, erro_anterior=last_error, sql_anterior=sql_validada)
            if not sql_gerada.strip():
                sql_gerada = _gerar_sql_fallback(pergunta)
                logger.info("SQL fallback local na tentativa %s: %s", attempt, sql_gerada)
            else:
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
            if not usar_fallback_prioritario and _gerar_sql_fallback(pergunta):
                usar_fallback_prioritario = True
            if attempt >= MAX_SQL_ATTEMPTS:
                return f"Não consegui consultar o banco agora. Erro: {last_error}"

    resposta = gerar_resposta_final(pergunta, sql_validada, resultado, mostrar_sql=_usuario_pediu_sql(pergunta))
    if not resposta.strip():
        if not resultado:
            return "Não encontrei registros para essa pergunta."
        preview = json.dumps(resultado[:10], ensure_ascii=False, default=str, indent=2)
        return f"Encontrei {len(resultado)} registro(s), mas não consegui gerar o resumo agora.\n{preview}"
    return resposta
