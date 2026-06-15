from flask import Blueprint, jsonify, request
import requests
import uuid

from auth_utils import buscar_usuario_por_token, extrair_token

admin_usuarios_bp = Blueprint("admin_usuarios_bp", __name__)


def _nivel_usuario(usuario):
    try:
        return int((usuario or {}).get("level") or 0)
    except (TypeError, ValueError):
        return 0


def _usuario_admin_por_request():
    token = extrair_token(request)
    if not token:
        return None, (jsonify({"success": False, "error": "Token não informado."}), 401)

    usuario = buscar_usuario_por_token(token)
    if not usuario:
        return None, (jsonify({"success": False, "error": "Token inválido."}), 401)

    if _nivel_usuario(usuario) != 3:
        return None, (jsonify({"success": False, "error": "Acesso negado. Requer nível 3."}), 403)

    return usuario, None


def _sanitizar_usuario(row):
    row = row or {}
    dados = row.get("dados") if isinstance(row.get("dados"), dict) else {}
    return {
        "userid": row.get("userid"),
        "user": row.get("user"),
        "nome": row.get("nome") or dados.get("nome"),
        "storeid": row.get("storeid"),
        "level": row.get("level"),
        "dados": dados,
        "aprovado": bool(row.get("token")),
    }


@admin_usuarios_bp.route("/api/admin/usuarios", methods=["GET"])
def admin_listar_usuarios():
    admin, erro = _usuario_admin_por_request()
    if erro:
        return erro

    from app import SUPABASE_URL, HEADERS
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/usuarios",
            headers=HEADERS,
            params={
                "select": "userid,user,storeid,level,dados,nome,token",
                "order": "user.asc"
            },
            timeout=20
        )
        response.raise_for_status()
        usuarios = [_sanitizar_usuario(row) for row in (response.json() or [])]
        return jsonify({"success": True, "usuarios": usuarios})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@admin_usuarios_bp.route("/api/admin/usuarios/<userid>", methods=["PATCH"])
def admin_atualizar_usuario(userid):
    admin, erro = _usuario_admin_por_request()
    if erro:
        return erro

    from app import SUPABASE_URL, HEADERS
    data = request.json or {}
    userid = (userid or "").strip()
    if not userid:
        return jsonify({"success": False, "error": "userid não informado."}), 400

    try:
        atual_res = requests.get(
            f"{SUPABASE_URL}/rest/v1/usuarios",
            headers=HEADERS,
            params={
                "select": "userid,token",
                "userid": f"eq.{userid}",
                "limit": "1"
            },
            timeout=20
        )
        atual_res.raise_for_status()
        atuais = atual_res.json() or []
        if not atuais:
            return jsonify({"success": False, "error": "Usuário não encontrado."}), 404

        token_atual = atuais[0].get("token") or ""
        payload = {}

        if "user" in data:
            user = (data.get("user") or "").strip()
            if not user:
                return jsonify({"success": False, "error": "Usuário não pode ficar vazio."}), 400
            payload["user"] = user

        if "nome" in data:
            payload["nome"] = (data.get("nome") or "").strip() or None

        if "storeid" in data:
            payload["storeid"] = (data.get("storeid") or "").strip() or None

        if "level" in data:
            try:
                level = int(data.get("level"))
            except (TypeError, ValueError):
                return jsonify({"success": False, "error": "Level inválido."}), 400
            if level not in (1, 2, 3):
                return jsonify({"success": False, "error": "Level deve ser 1, 2 ou 3."}), 400
            payload["level"] = level

        if "dados" in data:
            dados = data.get("dados")
            if dados is not None and not isinstance(dados, dict):
                return jsonify({"success": False, "error": "dados deve ser um objeto JSON."}), 400
            payload["dados"] = dados or {}

        if "aprovado" in data:
            aprovado = bool(data.get("aprovado"))
            payload["token"] = (token_atual or str(uuid.uuid4())) if aprovado else ""

        if not payload:
            return jsonify({"success": False, "error": "Nenhuma alteração enviada."}), 400

        response = requests.patch(
            f"{SUPABASE_URL}/rest/v1/usuarios",
            headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"},
            params={
                "userid": f"eq.{userid}",
                "select": "userid,user,storeid,level,dados,nome,token"
            },
            json=payload,
            timeout=20
        )
        response.raise_for_status()
        atualizados = response.json() or []
        usuario = _sanitizar_usuario(atualizados[0]) if atualizados else None
        return jsonify({"success": True, "usuario": usuario})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
