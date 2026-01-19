import requests
from flask import Blueprint, request, jsonify

api_task = Blueprint("api_task", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


@api_task.route("/api/tarefas", methods=["GET"])
def listar_tarefas():
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/tarefas?select=*",
        headers=HEADERS,
    )
    r.raise_for_status()
    return jsonify(r.json())


@api_task.route("/api/tarefas", methods=["POST"])
def criar_tarefa():
    data = request.json or {}

    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/tarefas",
        headers={**HEADERS, "Prefer": "return=representation"},
        json=data,
    )
    r.raise_for_status()

    res = r.json()
    return jsonify(res[0] if res else {}), 201


@api_task.route("/api/tarefas/<uuid>", methods=["PATCH"])
def atualizar_tarefa(uuid):
    data = request.json or {}

    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/tarefas?id=eq.{uuid}",
        headers={**HEADERS, "Prefer": "return=representation"},
        json=data,
    )
    r.raise_for_status()

    res = r.json()
    return jsonify(res[0] if res else {})

