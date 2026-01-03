from flask import Blueprint, request, jsonify
import requests
import uuid

cadastro_login_bp = Blueprint("cadastro_login_bp", __name__)


def _buscar_usuario_por_login(login):
    from app import SUPABASE_URL, HEADERS
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/usuarios",
        headers=HEADERS,
        params={
            "select": "userid,user,pass,token",
            "user": f"eq.{login}"
        }
    )
    response.raise_for_status()
    return response.json()


@cadastro_login_bp.route("/api/usuarios/cadastro", methods=["POST"])
def cadastrar_usuario():
    from app import SUPABASE_URL, HEADERS
    data = request.json or {}
    login = (data.get("user") or "").strip()
    senha = (data.get("pass") or "").strip()

    if not login or not senha:
        return jsonify({"success": False, "error": "Usuário e senha são obrigatórios."}), 400

    try:
        existentes = _buscar_usuario_por_login(login)
        if existentes:
            return jsonify({"success": False, "error": "Usuário já cadastrado."}), 409

        payload = {
            "userid": str(uuid.uuid4()),
            "user": login,
            "pass": senha
        }

        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/usuarios",
            headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"},
            json=payload
        )
        response.raise_for_status()
        usuario = response.json()[0]

        return jsonify({
            "success": True,
            "userid": usuario.get("userid"),
            "message": "Cadastro realizado. Aguarde aprovação do admin."
        })

    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@cadastro_login_bp.route("/api/usuarios/login", methods=["POST"])
def login_usuario():
    from app import TOKEN_DO_ADMIN
    data = request.json or {}
    login = (data.get("user") or "").strip()
    senha = (data.get("pass") or "").strip()

    if not login or not senha:
        return jsonify({"success": False, "error": "Usuário e senha são obrigatórios."}), 400

    if not TOKEN_DO_ADMIN:
        return jsonify({"success": False, "error": "Token do admin não configurado."}), 500

    try:
        encontrados = _buscar_usuario_por_login(login)
        if not encontrados:
            return jsonify({"success": False, "error": "Usuário não encontrado."}), 404

        usuario = encontrados[0]
        if usuario.get("pass") != senha:
            return jsonify({"success": False, "error": "Senha inválida."}), 401

        token_usuario = usuario.get("token") or ""
        if token_usuario != TOKEN_DO_ADMIN:
            return jsonify({
                "success": False,
                "error": "Usuário ainda não aprovado pelo admin."
            }), 403

        return jsonify({
            "success": True,
            "userid": usuario.get("userid"),
            "user": usuario.get("user"),
            "message": "Login autorizado."
        })

    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
