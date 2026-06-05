"""Configurações do bot Telegram + Gemini + Supabase da ColorGlass."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Iterable

from dotenv import load_dotenv

DEFAULT_ASSISTANT_PROMPT = (
    "Você é um assistente virtual da ColorGlass Fortaleza. "
    "Converse de forma natural, educada e objetiva em português do Brasil. "
    "Ajude com dúvidas sobre pedidos, orçamentos, produtos, atendimento e informações gerais. "
    "Quando precisar consultar dados do banco, avise que fará uma consulta em modo somente leitura. "
    "Nunca diga que salvou, alterou ou atualizou dados no sistema."
)

DEFAULT_SUPABASE_READ_TABLES: tuple[str, ...] = (
    "estado_conversa",
    "orcamentos",
    "pagamentos",
    "portas",
    "usuarios",
    "clientes",
    "materiais",
    "perfis",
    "vidros",
    "puxadores",
    "trilhos",
    "sistemas",
    "fornecedores",
    "imagetags",
    "tarefas",
    "tags",
    "comprovantes",
    "estruturas",
)

# Carrega variáveis de um .env local quando existir, mas NÃO sobrescreve variáveis
# configuradas no ambiente do servidor (ex.: Render Environment Variables).
load_dotenv(override=False)


REQUIRED_ENV_VARS: tuple[str, ...] = (
    "TELEGRAM_TOKEN",
    "TELEGRAM_CHAT_ID",
    "GEMINI_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
)


@dataclass(frozen=True)
class Settings:
    telegram_token: str
    telegram_chat_id: str
    gemini_api_key: str
    supabase_url: str
    supabase_service_role_key: str
    gemini_model: str = "gemini-2.0-flash"
    flask_host: str = "0.0.0.0"
    flask_port: int = 5000
    flask_debug: bool = False
    public_base_url: str = ""
    assistant_prompt: str = DEFAULT_ASSISTANT_PROMPT
    pedidos_table: str = "orcamentos"
    orcamentos_table: str = "orcamentos"
    conversation_state_table: str = "conversation_states"
    supabase_read_tables: tuple[str, ...] = DEFAULT_SUPABASE_READ_TABLES
    database_agent_allowed: bool = True
    database_agent_default_limit: int = 300
    database_agent_max_rows: int = 300


def _missing_env_vars(required: Iterable[str] = REQUIRED_ENV_VARS) -> list[str]:
    return [name for name in required if not os.getenv(name)]


def validate_required_env() -> None:
    """Valida variáveis obrigatórias e falha cedo com mensagem clara."""
    missing = _missing_env_vars()
    if missing:
        joined = ", ".join(missing)
        raise RuntimeError(
            f"Variáveis de ambiente obrigatórias ausentes: {joined}. "
            "Configure-as no .env local ou nas Environment Variables do Render."
        )


def _get_port() -> int:
    """Retorna a porta correta para local/Render.

    O Render injeta a variável PORT e espera que o processo escute exatamente
    nessa porta. FLASK_PORT fica como fallback para uso local.
    """
    return int(os.getenv("PORT") or os.getenv("FLASK_PORT", "5000"))


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on", "sim"}


def _parse_positive_int(name: str, default: int) -> int:
    raw = os.getenv(name, str(default))
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return default
    return max(1, value)


def _parse_read_tables() -> tuple[str, ...]:
    raw = os.getenv("SUPABASE_READ_TABLES", "")
    if not raw.strip():
        return DEFAULT_SUPABASE_READ_TABLES
    tables = tuple(table.strip() for table in raw.split(",") if table.strip())
    return tables or DEFAULT_SUPABASE_READ_TABLES


def get_settings(validate: bool = True) -> Settings:
    """Retorna configurações carregadas do ambiente.

    O python-dotenv carrega o .env somente como apoio local. Em produção no Render,
    variáveis configuradas em Environment Variables são lidas diretamente por os.getenv.
    """
    if validate:
        validate_required_env()

    return Settings(
        telegram_token=os.getenv("TELEGRAM_TOKEN", ""),
        telegram_chat_id=os.getenv("TELEGRAM_CHAT_ID", ""),
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        supabase_url=os.getenv("SUPABASE_URL", ""),
        supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        flask_host=os.getenv("FLASK_HOST", "0.0.0.0"),
        flask_port=_get_port(),
        flask_debug=os.getenv("FLASK_DEBUG", "false").lower() in {"1", "true", "yes", "on"},
        public_base_url=os.getenv("PUBLIC_BASE_URL", "").rstrip("/"),
        assistant_prompt=os.getenv("ASSISTANT_PROMPT", DEFAULT_ASSISTANT_PROMPT),
        pedidos_table=os.getenv("SUPABASE_PEDIDOS_TABLE", "orcamentos"),
        orcamentos_table=os.getenv("SUPABASE_ORCAMENTOS_TABLE", "orcamentos"),
        conversation_state_table=os.getenv("SUPABASE_CONVERSATION_STATE_TABLE", "conversation_states"),
        supabase_read_tables=_parse_read_tables(),
        database_agent_allowed=_parse_bool(os.getenv("DATABASE_AGENT_ALLOWED"), True),
        database_agent_default_limit=_parse_positive_int("DATABASE_AGENT_DEFAULT_LIMIT", 300),
        database_agent_max_rows=min(_parse_positive_int("DATABASE_AGENT_MAX_ROWS", 300), 300),
    )
