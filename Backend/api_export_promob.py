import csv
import io
import re
from datetime import datetime

import requests
from flask import Blueprint, Response, jsonify, request

from app import HEADERS, SUPABASE_URL

export_promob_bp = Blueprint("export_promob_bp", __name__)


def _slugify(valor):
    valor = (valor or "").strip().upper()
    valor = re.sub(r"[^A-Z0-9]+", "_", valor)
    valor = re.sub(r"_+", "_", valor).strip("_")
    return valor


def _normalizar_unidade(unidade):
    if not unidade:
        return ""
    unidade = unidade.strip().upper()
    if unidade in {"M2", "M²", "MT2", "MTS2", "METRO2", "METRO QUADRADO"}:
        return "M2"
    if unidade in {"ML", "M", "MT", "METRO", "METRO LINEAR"}:
        return "ML"
    if unidade in {"UN", "UND", "UNIDADE", "UNIDADES"}:
        return "UN"
    return unidade


def _build_sku(prefixo, descricao):
    return f"{prefixo}_{_slugify(descricao)}"


def _fetch_table(table, select):
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/{table}?select={select}",
        headers=HEADERS,
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def _linhas_vidros():
    vidros = _fetch_table("vidros", "id,tipo,espessura,preco")
    linhas = []
    for vidro in vidros:
        tipo = vidro.get("tipo") or ""
        espessura = vidro.get("espessura")
        descricao = f"{tipo} {espessura}mm".strip() if espessura else tipo
        sku = _build_sku("VIDRO", descricao)
        linhas.append(
            {
                "sku": sku,
                "descricao": descricao,
                "unidade": "M2",
                "preco": vidro.get("preco", 0),
            }
        )
    return linhas


def _linhas_perfis():
    perfis = _fetch_table("perfis", "id,nome,preco")
    linhas = []
    for perfil in perfis:
        nome = perfil.get("nome") or ""
        linhas.append(
            {
                "sku": _build_sku("PERFIL", nome),
                "descricao": nome,
                "unidade": "ML",
                "preco": perfil.get("preco", 0),
            }
        )
    return linhas


def _linhas_puxadores():
    puxadores = _fetch_table("puxadores", "id,nome,tipo_medida,preco")
    linhas = []
    for puxador in puxadores:
        nome = puxador.get("nome") or ""
        linhas.append(
            {
                "sku": _build_sku("PUXADOR", nome),
                "descricao": nome,
                "unidade": _normalizar_unidade(puxador.get("tipo_medida")),
                "preco": puxador.get("preco", 0),
            }
        )
    return linhas


def _linhas_insumos():
    materiais = _fetch_table("materiais", "id,nome,tipo_medida,preco")
    linhas = []
    for material in materiais:
        nome = material.get("nome") or ""
        linhas.append(
            {
                "sku": _build_sku("INSUMO", nome),
                "descricao": nome,
                "unidade": _normalizar_unidade(material.get("tipo_medida")),
                "preco": material.get("preco", 0),
            }
        )
    return linhas


@export_promob_bp.route("/api/promob/export", methods=["GET"])
def export_promob_csv():
    try:
        incluir_insumos = request.args.get("incluir_insumos", "true").lower() != "false"
        tabela = request.args.get("tabela")
        cliente_id = request.args.get("cliente_id")

        linhas = []
        linhas.extend(_linhas_vidros())
        linhas.extend(_linhas_perfis())
        linhas.extend(_linhas_puxadores())
        if incluir_insumos:
            linhas.extend(_linhas_insumos())

        linhas.sort(key=lambda item: item["sku"])

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["SKU", "Descricao", "Unidade", "Preco"])
        for linha in linhas:
            writer.writerow(
                [
                    linha["sku"],
                    linha["descricao"],
                    linha["unidade"],
                    f'{float(linha["preco"]):.2f}',
                ]
            )

        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        parts = ["promob", timestamp]
        if tabela:
            parts.append(_slugify(tabela))
        if cliente_id:
            parts.append(_slugify(cliente_id))
        filename = f'{"_".join(parts)}.csv'

        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
