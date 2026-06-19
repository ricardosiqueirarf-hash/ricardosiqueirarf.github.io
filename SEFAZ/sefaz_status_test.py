"""
MVP técnico: teste de comunicação direta com SEFAZ.

Primeiro teste recomendado: NfeStatusServico4 em homologação.
Este script NÃO emite NF-e. Ele apenas tenta consultar o status do serviço.

Requisitos:
1. Copiar .env.example para .env
2. Preencher SEFAZ_STATUS_URL, SEFAZ_CUF, SEFAZ_TP_AMB
3. Configurar certificado A1 localmente
4. Converter o PFX para PEM se necessário, conforme sua stack HTTP

Atenção:
- Nunca suba certificado ou senha para o GitHub.
- Os endpoints variam por UF/autorizador. Confirme no Portal NF-e/SEFAZ.
"""

from __future__ import annotations

import os
from pathlib import Path
from datetime import datetime

import requests
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
TEMPLATE_PATH = BASE_DIR / "payloads" / "status_servico_soap.xml"
LOG_DIR = BASE_DIR / "logs"


def load_template() -> str:
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Template SOAP não encontrado: {TEMPLATE_PATH}")
    return TEMPLATE_PATH.read_text(encoding="utf-8")


def build_status_payload() -> str:
    tp_amb = os.getenv("SEFAZ_TP_AMB", "2").strip()
    cuf = os.getenv("SEFAZ_CUF", "23").strip()

    xml = load_template()
    xml = xml.replace("{{TP_AMB}}", tp_amb)
    xml = xml.replace("{{CUF}}", cuf)
    return xml


def save_log(prefix: str, content: str) -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = LOG_DIR / f"{stamp}_{prefix}.xml"
    path.write_text(content, encoding="utf-8")
    return path


def consultar_status_servico() -> None:
    load_dotenv(BASE_DIR / ".env")

    status_url = os.getenv("SEFAZ_STATUS_URL", "").strip()
    if not status_url or "URL-DE-HOMOLOGACAO" in status_url:
        raise RuntimeError("Configure SEFAZ_STATUS_URL no arquivo .env antes de rodar o teste.")

    payload = build_status_payload()
    request_log = save_log("request_status_servico", payload)

    headers = {
        "Content-Type": "application/soap+xml; charset=utf-8",
    }

    # IMPORTANTE:
    # Alguns ambientes exigem certificado cliente no TLS.
    # O requests aceita certificado em PEM: cert=(cert.pem, key.pem) ou cert="arquivo.pem".
    # PFX normalmente precisa ser convertido para PEM localmente ou carregado com outra lib.
    cert_pem = os.getenv("SEFAZ_CERT_PEM_PATH", "").strip()
    key_pem = os.getenv("SEFAZ_KEY_PEM_PATH", "").strip()

    cert = None
    if cert_pem and key_pem:
        cert = (cert_pem, key_pem)
    elif cert_pem:
        cert = cert_pem

    response = requests.post(
        status_url,
        data=payload.encode("utf-8"),
        headers=headers,
        cert=cert,
        timeout=30,
    )

    response_log = save_log("response_status_servico", response.text)

    print("Status HTTP:", response.status_code)
    print("Request salvo em:", request_log)
    print("Response salvo em:", response_log)
    print("Trecho da resposta:")
    print(response.text[:1200])

    response.raise_for_status()


if __name__ == "__main__":
    consultar_status_servico()
