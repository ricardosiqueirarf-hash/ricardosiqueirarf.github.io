"""Cálculo fixo de orçamento da ColorGlass.

IMPORTANTE: esta regra é provisória. Troque as tabelas e fórmulas abaixo pelas regras
reais da ColorGlass quando os custos oficiais, perdas, impostos e margens estiverem
validados. A IA nunca deve calcular ou inventar preços; ela apenas extrai dados.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any

PERDA_PERCENTUAL = Decimal("0.10")
MARGEM_PERCENTUAL = Decimal("0.40")

CUSTOS_PERFIL_ML: dict[tuple[str, str], Decimal] = {
    ("1036", "preto"): Decimal("25"),
    ("1036", "prata"): Decimal("22"),
}

CUSTOS_VIDRO_M2: dict[str, Decimal] = {
    "espelho prata 4mm": Decimal("120"),
    "reflecta bronze 4mm": Decimal("140"),
}


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _normalize_text(value: Any) -> str:
    return str(value or "").strip().lower()


def _decimal(value: Any) -> Decimal:
    return Decimal(str(value).replace(",", "."))


def calcular_orcamento(dados: dict[str, Any]) -> dict[str, Any]:
    """Calcula orçamento com fórmula fixa provisória e custos internos controlados."""
    perfil = _normalize_text(dados.get("perfil"))
    cor = _normalize_text(dados.get("cor"))
    vidro = _normalize_text(dados.get("vidro"))

    custo_ml_perfil = CUSTOS_PERFIL_ML.get((perfil, cor))
    if custo_ml_perfil is None:
        raise ValueError(
            f"Custo não cadastrado para perfil '{dados.get('perfil')}' na cor '{dados.get('cor')}'."
        )

    custo_m2_vidro = CUSTOS_VIDRO_M2.get(vidro)
    if custo_m2_vidro is None:
        raise ValueError(f"Custo não cadastrado para vidro '{dados.get('vidro')}'.")

    largura_mm = _decimal(dados["largura_mm"])
    altura_mm = _decimal(dados["altura_mm"])
    quantidade = _decimal(dados["quantidade"])

    area_vidro_m2 = largura_mm * altura_mm / Decimal("1000000") * quantidade
    perimetro_aluminio_ml = ((largura_mm + altura_mm) * Decimal("2") / Decimal("1000")) * quantidade
    custo_vidro = area_vidro_m2 * custo_m2_vidro
    custo_aluminio = perimetro_aluminio_ml * custo_ml_perfil
    custo_base = custo_vidro + custo_aluminio
    custo_total_com_perda = custo_base * (Decimal("1") + PERDA_PERCENTUAL)
    total = custo_total_com_perda * (Decimal("1") + MARGEM_PERCENTUAL)

    return {
        "area_vidro_m2": float(area_vidro_m2),
        "perimetro_aluminio_ml": float(perimetro_aluminio_ml),
        "custo_m2_vidro": float(custo_m2_vidro),
        "custo_ml_perfil": float(custo_ml_perfil),
        "custo_vidro": float(_money(custo_vidro)),
        "custo_aluminio": float(_money(custo_aluminio)),
        "custo_base": float(_money(custo_base)),
        "perda_percentual": float(PERDA_PERCENTUAL),
        "margem_percentual": float(MARGEM_PERCENTUAL),
        "total": float(_money(total)),
    }
