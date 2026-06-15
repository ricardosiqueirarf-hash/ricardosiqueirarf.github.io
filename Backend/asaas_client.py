import os
import re
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

import requests


ASAAS_BASE_URL = (os.getenv("ASAAS_BASE_URL") or "https://api.asaas.com/v3").rstrip("/")
ASAAS_API_KEY = os.getenv("ASAAS_API_KEY") or ""


class AsaasConfigError(RuntimeError):
    pass


class AsaasApiError(RuntimeError):
    pass


def apenas_digitos(valor):
    return re.sub(r"\D+", "", str(valor or ""))


def decimal_money(valor):
    return Decimal(str(valor or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def asaas_headers():
    if not ASAAS_API_KEY:
        raise AsaasConfigError("ASAAS_API_KEY não configurada no ambiente do backend.")

    return {
        "accept": "application/json",
        "content-type": "application/json",
        "access_token": ASAAS_API_KEY,
    }


def _request(method, path, **kwargs):
    url = f"{ASAAS_BASE_URL}{path}"
    try:
        response = requests.request(
            method,
            url,
            headers=asaas_headers(),
            timeout=30,
            **kwargs,
        )
    except requests.RequestException as exc:
        raise AsaasApiError(f"Erro de conexão com Asaas: {exc}") from exc

    if response.ok:
        return response.json() if response.text else {}

    detalhe = response.text
    try:
        body = response.json()
        errors = body.get("errors")
        if isinstance(errors, list) and errors:
            detalhe = "; ".join(str(item.get("description") or item) for item in errors)
        else:
            detalhe = body.get("description") or body.get("message") or detalhe
    except ValueError:
        pass

    raise AsaasApiError(f"Asaas HTTP {response.status_code}: {detalhe}")


def buscar_cliente_por_cpf_cnpj(cpf_cnpj):
    documento = apenas_digitos(cpf_cnpj)
    if not documento:
        return None

    data = _request("GET", "/customers", params={"cpfCnpj": documento, "limit": 1})
    clientes = data.get("data") if isinstance(data, dict) else None
    if isinstance(clientes, list) and clientes:
        return clientes[0]
    return None


def criar_cliente(cliente):
    dados = cliente or {}
    nome = (dados.get("nome") or dados.get("name") or "").strip()
    cpf_cnpj = apenas_digitos(dados.get("cpf_cnpj") or dados.get("cpfCnpj"))

    if not nome:
        raise ValueError("Nome do cliente não informado para criar cliente no Asaas.")
    if not cpf_cnpj:
        raise ValueError("CPF/CNPJ do cliente não informado para criar cliente no Asaas.")

    payload = {
        "name": nome,
        "cpfCnpj": cpf_cnpj,
        "email": (dados.get("email") or "").strip() or None,
        "mobilePhone": apenas_digitos(dados.get("whatsapp") or dados.get("mobilePhone")) or None,
        "postalCode": apenas_digitos(dados.get("cep") or dados.get("postalCode")) or None,
        "address": (dados.get("endereco") or dados.get("address") or "").strip() or None,
        "externalReference": str(dados.get("external_reference") or dados.get("externalReference") or "").strip() or None,
        "notificationDisabled": False,
    }

    payload = {k: v for k, v in payload.items() if v not in (None, "")}
    return _request("POST", "/customers", json=payload)


def obter_ou_criar_cliente(cliente):
    existente = buscar_cliente_por_cpf_cnpj(cliente.get("cpf_cnpj") or cliente.get("cpfCnpj"))
    if existente:
        return existente
    return criar_cliente(cliente)


def criar_cobranca_boleto(customer_id, valor, vencimento, descricao, external_reference):
    if not customer_id:
        raise ValueError("customer_id do Asaas não informado.")

    valor_decimal = decimal_money(valor)
    if valor_decimal <= 0:
        raise ValueError("Valor da cobrança precisa ser maior que zero.")

    if isinstance(vencimento, date):
        due_date = vencimento.isoformat()
    else:
        due_date = str(vencimento)

    payload = {
        "customer": customer_id,
        "billingType": "BOLETO",
        "value": float(valor_decimal),
        "dueDate": due_date,
        "description": descricao,
        "externalReference": external_reference,
    }

    return _request("POST", "/payments", json=payload)


def consultar_cobranca(payment_id):
    if not payment_id:
        raise ValueError("payment_id não informado.")
    return _request("GET", f"/payments/{payment_id}")
