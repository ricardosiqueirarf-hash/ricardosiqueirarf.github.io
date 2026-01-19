import os
import requests
from flask import Blueprint, request, jsonify

api_task = Blueprint("api_task", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # use SERVICE ROLE no backend

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


# ==========================
# BUSCAR TAREFAS
# ==========================
@api_task.route("/api/tarefas", methods=["GET"])
def listar_tarefas():
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/tarefas?select=*",
        headers=HEADERS,
    )
    r.raise_for_status()
    return jsonify(r.json())


# ==========================
# MARCAR / DESMARCAR
# ==========================
@api_task.route("/api/tarefas/<uuid>", methods=["PATCH"])
def atualizar_tarefa(uuid):
    body = request.json

    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/tarefas?id=eq.{uuid}",
        headers={
            **HEADERS,
            "Prefer": "return=representation",
        },
        json=body,
    )
    r.raise_for_status()

    data = r.json()
    return jsonify(data[0] if data else {})
