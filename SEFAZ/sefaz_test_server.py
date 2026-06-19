"""
Servidor Flask para testar comunicação com SEFAZ via HTML.

Local:
1. cd SEFAZ
2. python -m venv .venv
3. .venv\Scripts\activate  # Windows
4. pip install -r requirements.txt
5. copie .env.example para .env e configure certificado/endpoints
6. python sefaz_test_server.py
7. abra http://127.0.0.1:5055

Render:
- Root Directory: SEFAZ
- Build Command: pip install -r requirements.txt
- Start Command: gunicorn sefaz_test_server:app

Importante:
- Este servidor é de teste/homologação.
- Não usar para emissão real em produção.
- Não envia certificado para o navegador.
- O certificado fica em variável/secret do ambiente.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from datetime import datetime
from typing import Any

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from lxml import etree

BASE_DIR = Path(__file__).resolve().parent
TEMPLATE_PATH = BASE_DIR / "payloads" / "status_servico_soap.xml"
LOG_DIR = BASE_DIR / "logs"

load_dotenv(BASE_DIR / ".env")

app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    """Permite abrir o HTML localmente e também usar o app hospedado."""
    allowed_origin = os.getenv("SEFAZ_ALLOWED_ORIGIN", "*").strip() or "*"
    response.headers["Access-Control-Allow-Origin"] = allowed_origin
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-SEFAZ-TEST-TOKEN"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.route("/healthz", methods=["GET"])
def healthz():
    return jsonify({"ok": True, "service": "sefaz-test", "ambiente": "homologacao"})


@app.route("/", methods=["GET"])
def home():
    html_path = BASE_DIR / "sefaz_teste.html"
    if html_path.exists():
        return html_path.read_text(encoding="utf-8")
    return "SEFAZ test server online"


@app.route("/api/sefaz/status/payload", methods=["POST", "OPTIONS"])
def preview_status_payload():
    if request.method == "OPTIONS":
        return "", 204

    auth_error = require_test_token()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}
    try:
        payload = build_status_payload(data)
        return jsonify({"ok": True, "payload": payload})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


@app.route("/api/sefaz/status", methods=["POST", "OPTIONS"])
def consultar_status():
    if request.method == "OPTIONS":
        return "", 204

    auth_error = require_test_token()
    if auth_error:
        return auth_error

    data = request.get_json(silent=True) or {}

    try:
        payload = build_status_payload(data)
        status_url = get_status_url(data)
        timeout = int(data.get("timeout") or 30)

        request_log = save_log("request_status_servico", payload)

        headers = {
            "Content-Type": "application/soap+xml; charset=utf-8",
        }

        cert = get_requests_cert()

        response = requests.post(
            status_url,
            data=payload.encode("utf-8"),
            headers=headers,
            cert=cert,
            timeout=timeout,
        )

        response_log = save_log("response_status_servico", response.text)
        parsed = parse_sefaz_response(response.text)

        body = {
            "ok": response.ok,
            "http_status": response.status_code,
            "cStat": parsed.get("cStat"),
            "xMotivo": parsed.get("xMotivo"),
            "request_log": str(request_log),
            "response_log": str(response_log),
            "response_text": response.text,
        }

        status_code = 200 if response.ok else 502
        return jsonify(body), status_code

    except Exception as exc:
        return jsonify({
            "ok": False,
            "error": str(exc),
        }), 500


def require_test_token():
    """
    Proteção simples para não deixar uma URL pública no Render chamando a SEFAZ livremente.

    Se SEFAZ_TEST_TOKEN estiver vazio, não exige token.
    Em Render, configure SEFAZ_TEST_TOKEN como secret/env var.
    """
    expected_token = os.getenv("SEFAZ_TEST_TOKEN", "").strip()
    if not expected_token:
        return None

    provided_token = request.headers.get("X-SEFAZ-TEST-TOKEN", "").strip()
    if provided_token != expected_token:
        return jsonify({"ok": False, "error": "Token de teste inválido ou ausente."}), 401

    return None


def build_status_payload(data: dict[str, Any]) -> str:
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Template SOAP não encontrado: {TEMPLATE_PATH}")

    tp_amb = str(data.get("tp_amb") or os.getenv("SEFAZ_TP_AMB") or "2").strip()
    cuf = only_digits(str(data.get("cuf") or os.getenv("SEFAZ_CUF") or "23"))

    if tp_amb != "2":
        raise ValueError("Este MVP aceita apenas tpAmb=2, homologação.")

    if not cuf:
        raise ValueError("Informe o cUF. Exemplo: CE = 23.")

    xml = TEMPLATE_PATH.read_text(encoding="utf-8")
    xml = xml.replace("{{TP_AMB}}", tp_amb)
    xml = xml.replace("{{CUF}}", cuf)
    return xml


def get_status_url(data: dict[str, Any]) -> str:
    status_url = str(data.get("status_url") or os.getenv("SEFAZ_STATUS_URL") or "").strip()

    if not status_url or "URL-DE-HOMOLOGACAO" in status_url:
        raise ValueError("Informe SEFAZ_STATUS_URL no formulário ou no ambiente do Render.")

    if not status_url.lower().startswith("https://"):
        raise ValueError("Use endpoint HTTPS da SEFAZ em homologação.")

    return status_url


def get_requests_cert():
    """
    requests não usa PFX diretamente.

    Opções:
    - SEFAZ_CERT_PEM_PATH + SEFAZ_KEY_PEM_PATH
    - SEFAZ_CERT_PEM_PATH contendo cert+key juntos

    Para Render, prefira Secret Files ou variáveis com conteúdo PEM materializado em arquivo
    antes do start command. Não commitar certificado no GitHub.
    """
    cert_pem = os.getenv("SEFAZ_CERT_PEM_PATH", "").strip()
    key_pem = os.getenv("SEFAZ_KEY_PEM_PATH", "").strip()

    if cert_pem and key_pem:
        return (cert_pem, key_pem)

    if cert_pem:
        return cert_pem

    return None


def save_log(prefix: str, content: str) -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = LOG_DIR / f"{stamp}_{prefix}.xml"
    path.write_text(content, encoding="utf-8")
    return path


def parse_sefaz_response(xml_text: str) -> dict[str, str | None]:
    result = {"cStat": None, "xMotivo": None}

    if not xml_text.strip():
        return result

    try:
        root = etree.fromstring(xml_text.encode("utf-8"))
    except Exception:
        return result

    cstat = root.xpath("//*[local-name()='cStat']/text()")
    xmotivo = root.xpath("//*[local-name()='xMotivo']/text()")

    if cstat:
        result["cStat"] = cstat[0]
    if xmotivo:
        result["xMotivo"] = xmotivo[0]

    return result


def only_digits(value: str) -> str:
    return re.sub(r"\D+", "", value or "")


if __name__ == "__main__":
    port = int(os.getenv("PORT") or os.getenv("SEFAZ_TEST_PORT", "5055"))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
