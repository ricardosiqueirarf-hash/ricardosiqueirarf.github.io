from flask import Blueprint, request, jsonify
import requests
from functools import wraps

perfis_bp = Blueprint("perfis_bp", __name__)

# ===================== UTIL =====================
def calcular_preco(custo, margem, perda):
    custo_com_perda = custo * (1 + perda / 100)
    return custo_com_perda * (1 + margem / 100)

# ===================== ROTAS PERFIS =====================
@perfis_bp.route("/api/perfis", methods=["GET"])
def listar_perfis():
    from app import SUPABASE_URL, HEADERS
    r = requests.get(f"{SUPABASE_URL}/rest/v1/perfis?select=*&order=nome.asc", headers=HEADERS)
    r.raise_for_status()
    return jsonify(r.json())

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
        "tipologias": data.get("tipologias", []),
        "insumos": data.get("insumos", [])  # <-- adicionado
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
        "tipologias": data.get("tipologias", []),
        "insumos": data.get("insumos", [])  # <-- adicionado
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

