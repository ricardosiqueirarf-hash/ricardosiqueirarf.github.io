from flask import Blueprint, request, jsonify
import requests
from functools import wraps

perfis_bp = Blueprint("perfis_bp", __name__)

# ===================== UTIL =====================
def calcular_preco(custo, margem, perda):
    custo_com_perda = custo * (1 + perda / 100)
    return custo_com_perda * (1 + margem / 100)


def normalizar_tipologia(valor):
    return "divisao_ambiente" if str(valor or "").strip() == "correr" else str(valor or "").strip()


def normalizar_tipologias(lista):
    resultado = []
    for item in lista or []:
        valor = normalizar_tipologia(item)
        if valor and valor not in resultado:
            resultado.append(valor)
    return resultado


def normalizar_lista_texto(lista):
    resultado = []
    for item in lista or []:
        valor = str(item or "").strip()
        if valor and valor not in resultado:
            resultado.append(valor)
    return resultado


# ===================== ROTAS PERFIS =====================
@perfis_bp.route("/api/perfis", methods=["GET"])
def listar_perfis():
    from app import SUPABASE_URL, HEADERS
    r = requests.get(f"{SUPABASE_URL}/rest/v1/perfis?select=*&order=nome.asc", headers=HEADERS)
    r.raise_for_status()
    perfis = r.json()
    for perfil in perfis:
        perfil["tipologias"] = normalizar_tipologias(perfil.get("tipologias", []))
        perfil["puxadores"] = normalizar_lista_texto(perfil.get("puxadores", []))
    return jsonify(perfis)


@perfis_bp.route("/api/perfis", methods=["POST"])
def criar_perfil():
    from app import SUPABASE_URL, HEADERS
    data = request.json
    preco = calcular_preco(float(data["custo"]), float(data["margem"]), float(data["perda"]))
    payload = {
        "nome": data["nome"],
        "custo": data["custo"],
        "margem": data["margem"],
        "perda": data["perda"],
        "preco": round(preco, 2),
        "tipologias": normalizar_tipologias(data.get("tipologias", [])),
        "insumos": normalizar_lista_texto(data.get("insumos", [])),
        "puxadores": normalizar_lista_texto(data.get("puxadores", []))
    }
    r = requests.post(f"{SUPABASE_URL}/rest/v1/perfis", headers=HEADERS, json=payload)
    r.raise_for_status()
    return jsonify({"status": "ok"})


@perfis_bp.route("/api/perfis/<id>", methods=["PUT"])
def editar_perfil(id):
    from app import SUPABASE_URL, HEADERS
    data = request.json
    preco = calcular_preco(float(data["custo"]), float(data["margem"]), float(data["perda"]))
    payload = {
        "nome": data["nome"],
        "custo": data["custo"],
        "margem": data["margem"],
        "perda": data["perda"],
        "preco": round(preco, 2),
        "tipologias": normalizar_tipologias(data.get("tipologias", [])),
        "insumos": normalizar_lista_texto(data.get("insumos", [])),
        "puxadores": normalizar_lista_texto(data.get("puxadores", []))
    }
    r = requests.patch(f"{SUPABASE_URL}/rest/v1/perfis?id=eq.{id}", headers=HEADERS, json=payload)
    r.raise_for_status()
    return jsonify({"status": "updated"})


@perfis_bp.route("/api/perfis/<id>", methods=["DELETE"])
def deletar_perfil(id):
    from app import SUPABASE_URL, HEADERS
    r = requests.delete(f"{SUPABASE_URL}/rest/v1/perfis?id=eq.{id}", headers=HEADERS)
    r.raise_for_status()
    return jsonify({"status": "deleted"})
