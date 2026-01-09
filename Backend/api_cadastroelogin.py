from flask import Blueprint, request, jsonify
import requests
import uuid

from auth_utils import buscar_usuario_por_token, construir_permissoes, extrair_token, gerar_token_usuario, pagina_por_nivel

cadastro_login_bp = Blueprint("cadastro_login_bp", __name__)


def _buscar_usuario_por_login(login):
    from app import SUPABASE_URL, HEADERS
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/usuarios",
        headers=HEADERS,
        params={
            "select": "userid,user,pass,token,level,storeid",
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
    dados = data.get("dados") or {}

    if not login or not senha:
        return jsonify({"success": False, "error": "Usuário e senha são obrigatórios."}), 400

    try:
        existentes = _buscar_usuario_por_login(login)
        if existentes:
            return jsonify({"success": False, "error": "Usuário já cadastrado."}), 409

        payload = {
            "userid": str(uuid.uuid4()),
            "user": login,
            "pass": senha,
            "dados": dados
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
    data = request.json or {}
    login = (data.get("user") or "").strip()
    senha = (data.get("pass") or "").strip()

    if not login or not senha:
        return jsonify({"success": False, "error": "Usuário e senha são obrigatórios."}), 400

    try:
        encontrados = _buscar_usuario_por_login(login)
        if not encontrados:
            return jsonify({"success": False, "error": "Usuário não encontrado."}), 404

        usuario = encontrados[0]
        if usuario.get("pass") != senha:
            return jsonify({"success": False, "error": "Senha inválida."}), 401

        token_usuario = usuario.get("token") or ""
        if not token_usuario:
            return jsonify({
                "success": False,
                "error": "Usuário ainda não aprovado pelo admin."
            }), 403

        token_sessao = gerar_token_usuario(usuario)

        return jsonify({
            "success": True,
            "userid": usuario.get("userid"),
            "user": usuario.get("user"),
            "token": token_sessao,
            "message": "Login autorizado."
        })

    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@cadastro_login_bp.route("/api/auth/validar", methods=["POST"])
def validar_token():
    token = extrair_token(request)
    if not token:
        return jsonify({"success": False, "error": "Token não informado."}), 400

    try:
        usuario = buscar_usuario_por_token(token)
        if not usuario:
            return jsonify({"success": False, "error": "Token inválido."}), 401

        try:
            level = int(usuario.get("level") or 0)
        except (TypeError, ValueError):
            level = 0

        permissions = construir_permissoes(level)
        return jsonify({
            "success": True,
            "level": level,
            "permissions": permissions,
            "redirect": pagina_por_nivel(level)
        })
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500



