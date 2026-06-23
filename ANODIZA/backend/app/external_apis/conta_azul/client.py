import os
import re
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

import requests


CONTA_AZUL_BASE_URL = (os.getenv("CONTA_AZUL_BASE_URL") or "https://api-v2.contaazul.com").rstrip("/")


class ContaAzulConfigError(RuntimeError):
    pass


class ContaAzulApiError(RuntimeError):
    pass


def apenas_digitos(valor: Any) -> str:
    return re.sub(r"\D+", "", str(valor or ""))


def decimal_money(valor: Any) -> Decimal:
    return Decimal(str(valor or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def conta_azul_headers(access_token: str) -> dict[str, str]:
    if not access_token:
        raise ContaAzulConfigError("Access token da Conta Azul nao configurado para esta empresa.")

    return {
        "accept": "application/json",
        "content-type": "application/json",
        "Authorization": f"Bearer {access_token}",
    }


def _request(access_token: str, method: str, path: str, **kwargs) -> dict[str, Any]:
    url = f"{CONTA_AZUL_BASE_URL}{path}"
    try:
        response = requests.request(
            method,
            url,
            headers=conta_azul_headers(access_token),
            timeout=30,
            **kwargs,
        )
    except requests.RequestException as exc:
        raise ContaAzulApiError(f"Erro de conexao com Conta Azul: {exc}") from exc

    if response.ok:
        return response.json() if response.text else {}

    detalhe = response.text
    try:
        body = response.json()
        detalhe = body.get("error") or body.get("description") or body.get("message") or detalhe
    except ValueError:
        pass

    raise ContaAzulApiError(f"Conta Azul HTTP {response.status_code}: {detalhe}")


def buscar_pessoa_por_documento(access_token: str, documento: str) -> dict[str, Any] | None:
    documento_limpo = apenas_digitos(documento)
    if not documento_limpo:
        return None

    data = _request(
        access_token,
        "GET",
        "/v1/pessoas",
        params={
            "documentos": documento_limpo,
            "tipo_perfil": "Cliente",
            "tamanho_pagina": 10,
        },
    )
    pessoas = data.get("items") if isinstance(data, dict) else None
    if isinstance(pessoas, list) and pessoas:
        return pessoas[0]
    return None


def criar_pessoa(access_token: str, payload: dict[str, Any]) -> dict[str, Any]:
    nome = str(payload.get("nome") or "").strip()
    if not nome:
        raise ValueError("Nome do cliente nao informado para criar pessoa na Conta Azul.")

    return _request(access_token, "POST", "/v1/pessoas", json=payload)


def obter_ou_criar_pessoa(access_token: str, payload: dict[str, Any]) -> dict[str, Any]:
    documento = payload.get("cpf") or payload.get("cnpj") or ""
    existente = buscar_pessoa_por_documento(access_token, str(documento))
    if existente:
        return existente
    return criar_pessoa(access_token, payload)


def proximo_numero_venda(access_token: str) -> int:
    data = _request(access_token, "GET", "/v1/venda/proximo-numero")
    if isinstance(data, int):
        return data
    for chave in ("numero", "next", "proximo_numero", "proximoNumero"):
        if isinstance(data, dict) and data.get(chave) is not None:
            return int(data[chave])
    raise ContaAzulApiError("Conta Azul nao retornou o proximo numero da venda.")


def criar_venda(access_token: str, payload: dict[str, Any]) -> dict[str, Any]:
    return _request(access_token, "POST", "/v1/venda", json=payload)


def data_iso(valor: date | str | None = None) -> str:
    if isinstance(valor, date):
        return valor.isoformat()
    if valor:
        return str(valor)[:10]
    return date.today().isoformat()
