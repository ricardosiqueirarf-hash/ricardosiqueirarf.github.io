import json
import os
import re
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


CONTA_AZUL_BASE_URL = (os.getenv("CONTA_AZUL_BASE_URL") or "https://api-v2.contaazul.com").rstrip("/")


class ContaAzulConfigError(RuntimeError):
    pass


class ContaAzulApiError(RuntimeError):
    pass


def apenas_digitos(valor: Any) -> str:
    return re.sub(r"\D+", "", str(valor or ""))


def decimal_money(valor: Any) -> Decimal:
    return Decimal(str(valor or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def conta_azul_headers(auth_value: str) -> dict[str, str]:
    if not auth_value:
        raise ContaAzulConfigError("Credencial da Conta Azul nao configurada para esta empresa.")

    return {
        "accept": "application/json",
        "content-type": "application/json",
        "Authorization": f"Bearer {auth_value}",
    }


def _decode_response(raw: bytes) -> dict[str, Any]:
    if not raw:
        return {}
    texto = raw.decode("utf-8", errors="replace")
    return json.loads(texto) if texto else {}


def _request(auth_value: str, method: str, path: str, **kwargs) -> dict[str, Any]:
    params = kwargs.pop("params", None) or {}
    query = f"?{urlencode(params)}" if params else ""
    url = f"{CONTA_AZUL_BASE_URL}{path}{query}"
    body = kwargs.pop("json", None)
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = Request(url, data=data, headers=conta_azul_headers(auth_value), method=method.upper())

    try:
        with urlopen(req, timeout=30) as response:
            return _decode_response(response.read())
    except HTTPError as exc:
        raw = exc.read()
        detalhe = raw.decode("utf-8", errors="replace") if raw else str(exc)
        try:
            body_error = json.loads(detalhe)
            detalhe = body_error.get("error") or body_error.get("description") or body_error.get("message") or detalhe
        except ValueError:
            pass
        raise ContaAzulApiError(f"Conta Azul HTTP {exc.code}: {detalhe}") from exc
    except URLError as exc:
        raise ContaAzulApiError(f"Erro de conexao com Conta Azul: {exc}") from exc


def buscar_pessoa_por_documento(auth_value: str, documento: str) -> dict[str, Any] | None:
    documento_limpo = apenas_digitos(documento)
    if not documento_limpo:
        return None

    data = _request(
        auth_value,
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


def criar_pessoa(auth_value: str, payload: dict[str, Any]) -> dict[str, Any]:
    nome = str(payload.get("nome") or "").strip()
    if not nome:
        raise ValueError("Nome do cliente nao informado para criar pessoa na Conta Azul.")

    return _request(auth_value, "POST", "/v1/pessoas", json=payload)


def obter_ou_criar_pessoa(auth_value: str, payload: dict[str, Any]) -> dict[str, Any]:
    documento = payload.get("cpf") or payload.get("cnpj") or ""
    existente = buscar_pessoa_por_documento(auth_value, str(documento))
    if existente:
        return existente
    return criar_pessoa(auth_value, payload)


def proximo_numero_venda(auth_value: str) -> int:
    data = _request(auth_value, "GET", "/v1/venda/proximo-numero")
    if isinstance(data, int):
        return data
    for chave in ("numero", "next", "proximo_numero", "proximoNumero"):
        if isinstance(data, dict) and data.get(chave) is not None:
            return int(data[chave])
    raise ContaAzulApiError("Conta Azul nao retornou o proximo numero da venda.")


def criar_venda(auth_value: str, payload: dict[str, Any]) -> dict[str, Any]:
    return _request(auth_value, "POST", "/v1/venda", json=payload)


def data_iso(valor: date | str | None = None) -> str:
    if isinstance(valor, date):
        return valor.isoformat()
    if valor:
        return str(valor)[:10]
    return date.today().isoformat()
