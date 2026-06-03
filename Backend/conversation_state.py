"""Gerenciamento de estado conversacional por chat_id para criação de orçamentos."""
from __future__ import annotations

from copy import deepcopy
from typing import Any

MINIMUM_BUDGET_FIELDS: tuple[str, ...] = (
    "cliente",
    "loja",
    "tipo_produto",
    "quantidade",
    "largura_mm",
    "altura_mm",
    "perfil",
    "cor",
    "vidro",
)

NUMERIC_FIELDS = {"quantidade", "largura_mm", "altura_mm"}


def get_initial_state() -> dict[str, Any]:
    return {
        "mode": None,
        "step": None,
        "budget_data": {},
        "calculation": None,
        "pending_confirmation": False,
        "last_question": None,
    }


def reset_state() -> dict[str, Any]:
    return get_initial_state()


def _normalize_value(field: str, value: Any) -> Any:
    if value is None or value == "":
        return None
    if field in NUMERIC_FIELDS:
        try:
            normalized = float(str(value).replace(",", "."))
            if field == "quantidade":
                return int(normalized)
            return normalized
        except (TypeError, ValueError):
            return value
    if isinstance(value, str):
        return value.strip()
    return value


def update_state_from_extracted_data(state: dict[str, Any], extracted: dict[str, Any] | None) -> dict[str, Any]:
    """Mescla campos extraídos pela IA no estado sem sobrescrever com valores vazios."""
    new_state = deepcopy(state or get_initial_state())
    new_state.setdefault("budget_data", {})

    if not extracted:
        return new_state

    for field, value in extracted.items():
        if field not in MINIMUM_BUDGET_FIELDS:
            continue
        normalized = _normalize_value(field, value)
        if normalized is not None:
            new_state["budget_data"][field] = normalized

    return new_state


def get_missing_fields(state: dict[str, Any]) -> list[str]:
    budget_data = (state or {}).get("budget_data", {})
    missing: list[str] = []
    for field in MINIMUM_BUDGET_FIELDS:
        value = budget_data.get(field)
        if value is None or value == "":
            missing.append(field)
    return missing


def is_ready_to_calculate(state: dict[str, Any]) -> bool:
    return not get_missing_fields(state)


def next_question_for_missing_fields(missing_fields: list[str]) -> str:
    if not missing_fields:
        return "Tenho todos os dados. Posso calcular o orçamento agora."

    if "cliente" in missing_fields or "loja" in missing_fields:
        return "Informe o cliente e a loja, por favor."
    if "tipo_produto" in missing_fields:
        return "Qual é o tipo de produto do orçamento?"
    if {"quantidade", "largura_mm", "altura_mm"}.intersection(missing_fields):
        return "Informe a quantidade, largura em mm e altura em mm."
    if "perfil" in missing_fields or "cor" in missing_fields:
        return "Informe o perfil e a cor do alumínio."
    if "vidro" in missing_fields:
        return "Qual vidro será usado? Exemplo: espelho prata 4mm ou reflecta bronze 4mm."

    readable = ", ".join(missing_fields)
    return f"Ainda faltam estes dados: {readable}."
