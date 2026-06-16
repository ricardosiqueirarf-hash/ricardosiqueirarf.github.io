from flask import Blueprint, request, jsonify, make_response
import requests
import uuid
import time
from datetime import datetime, timedelta

from auth_utils import buscar_usuario_por_token, construir_permissoes, extrair_token, gerar_token_usuario, pagina_por_nivel
from logger_sistema import log_login_autorizado

cadastro_login_bp = Blueprint("cadastro_login_bp", __name__)

# =====================
# RATE LIMIT SIMPLES DO LOGIN
# =====================
# Conservador para não quebrar acesso normal.
# Limita tentativas por IP e por combinação IP + usuário.
LOGIN_ATTEMPTS = {}
LOGIN_WINDOW_SECONDS = 15 * 60
LOGIN_MAX_BY_USER_IP = 8
LOGIN_MAX_BY_IP = 30


def _agora():
    return time.time()


def _agora_fortaleza():
    return datetime.utcnow() - timedelta(hours=3)


def _request_is_https():
    proto = (request.headers.get("X-Forwarded-Proto") or "").split(",")[0].strip().lower()
    return request.is_secure or proto == "https"


def _client_ip():
    forwarded = request.headers.get("X-Forwarded-For") or ""
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    return request.remote_addr or "unknown"


def _normalizar_login(login):
    return str(login or "").strip().lower()


def _limpar_tentativas_antigas():
    now = _agora()
    # Evita crescimento infinito em memória.
    for key in list(LOGIN_ATTEMPTS.keys()):
        recentes = [ts for ts in LOGIN_ATTEMPTS.get(key, []) if now - ts < LOGIN_WINDOW_SECONDS]
        if recentes:
            LOGIN_ATTEMPTS[key] = recentes
        else:
            LOGIN_ATTEMPTS.pop(key, None)


def _rate_keys(login):
    ip = _client_ip()
    login_norm = _normalizar_login(login)
    return f"ip:{ip}", f"ip_user:{ip}:{login_norm}"


def _rate_limit_excedido(login):
    _limpar_tentativas_antigas()
    ip_key, user_ip_key = _rate_keys(login)
    return (
        len(LOGIN_ATTEMPTS.get(user_ip_key, [])) >= LOGIN_MAX_BY_USER_IP
        or len(LOGIN_ATTEMPTS.get(ip_key, [])) >= LOGIN_MAX_BY_IP
    )


def _registrar_falha_login(login, motivo="credenciais_invalidas"):
    now = _agora()
    ip_key, user_ip_key = _rate_keys(login)
    LOGIN_ATTEMPTS.setdefault(ip_key, []).append(now)
    LOGIN_ATTEMPTS.setdefault(user_ip_key, []).append(now)
    print(f"[AUTH] falha_login ip={_client_ip()} user={_normalizar_login(login)} motivo={motivo}")


def _limpar_falhas_login(login):
    ip_key, user_ip_key = _rate_keys(login)
    LOGIN_ATTEMPTS.pop(user_ip_key, None)
    # Não limpa o contador geral do IP para não permitir rotação agressiva de usuários.
    print(f"[AUTH] login_ok ip={_client_ip()} user={_normalizar_login(login)}")


def _storeid_usuario(usuario):
    usuario = usuario or {}
    return (
        usuario.get("storeid")
        or usuario.get("storeID")
        or usuario.get("lojaid")
        or usuario.get("lojaID")
    )


def _nome_usuario(usuario):
    usuario = usuario or {}
    dados = usuario.get("dados") if isinstance(usuario.get("dados"), dict) else {}
    return (
        usuario.get("nome")
        or usuario.get("NOME")
        or dados.get("nome")
        or dados.get("NOME")
        or usuario.get("user")
        or ""
    )


def _buscar_usuario_por_login(login):
    from app import SUPABASE_URL, HEADERS
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/usuarios",
        headers=HEADERS,
        params={
            "select": "*",
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
    # Mantido com strip no backend por compatibilidade com senhas já cadastradas pelo fluxo antigo.
    # O frontend novo não altera mais o valor digitado da senha.
    senha = (data.get("pass") or "").strip()

    if not login or not senha:
        return jsonify({"success": False, "error": "Usuário e senha são obrigatórios."}), 400

    if _rate_limit_excedido(login):
        print(f"[AUTH] rate_limit ip={_client_ip()} user={_normalizar_login(login)}")
        return jsonify({
            "success": False,
            "error": "Muitas tentativas. Aguarde alguns minutos e tente novamente."
        }), 429

    try:
        encontrados = _buscar_usuario_por_login(login)
        if not encontrados:
            _registrar_falha_login(login, "usuario_ou_senha_invalidos")
            return jsonify({"success": False, "error": "Usuário ou senha inválidos."}), 401

        usuario = encontrados[0]
        if usuario.get("pass") != senha:
            _registrar_falha_login(login, "usuario_ou_senha_invalidos")
            return jsonify({"success": False, "error": "Usuário ou senha inválidos."}), 401

        token_usuario = usuario.get("token") or ""
        if not token_usuario:
            print(f"[AUTH] login_sem_aprovacao ip={_client_ip()} user={_normalizar_login(login)}")
            return jsonify({
                "success": False,
                "error": "Usuário ainda não aprovado pelo admin."
            }), 403

        _limpar_falhas_login(login)
        token_sessao = gerar_token_usuario(usuario)

        agora = _agora_fortaleza()
        log_login_autorizado(
            usuario,
            data_acesso=agora.strftime("%d/%m/%Y"),
            hora_acesso=agora.strftime("%H:%M:%S"),
            enviar_telegram_alerta=True,
        )

        response = make_response(jsonify({
            "success": True,
            "userid": usuario.get("userid"),
            "user": usuario.get("user"),
            "level": usuario.get("level"),
            "token": token_sessao,
            "message": "Login autorizado."
        }))
        response.set_cookie(
            "auth_token",
            token_sessao,
            max_age=12 * 60 * 60,
            httponly=True,
            secure=_request_is_https(),
            samesite="Lax",
            path="/"
        )
        return response

    except Exception as exc:
        print(f"[AUTH] erro_login ip={_client_ip()} user={_normalizar_login(login)} erro={exc}")
        return jsonify({"success": False, "error": "Erro interno ao validar login."}), 500


@cadastro_login_bp.route("/api/usuarios", methods=["GET", "OPTIONS"])
def listar_usuarios():
    if request.method == "OPTIONS":
        return ("", 204)

    from app import SUPABASE_URL, HEADERS
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/usuarios",
            headers=HEADERS,
            params={
                "select": "*"
            }
        )
        response.raise_for_status()
        usuarios = response.json() or []
        return jsonify({"success": True, "usuarios": usuarios})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@cadastro_login_bp.route("/api/lojas", methods=["GET", "OPTIONS"])
def listar_lojas_publicas():
    if request.method == "OPTIONS":
        return ("", 204)

    from app import SUPABASE_URL, HEADERS
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/usuarios",
            headers=HEADERS,
            params={
                "select": "storeid,nome,dados,user",
                "order": "nome.asc"
            },
            timeout=20
        )
        response.raise_for_status()
        lojas = []
        vistos = set()
        for usuario in response.json() or []:
            storeid = str(_storeid_usuario(usuario) or "").strip()
            nome = str(_nome_usuario(usuario) or "").strip()
            if not storeid or not nome or storeid in vistos:
                continue
            vistos.add(storeid)
            lojas.append({"storeid": storeid, "nome": nome})
        return jsonify({"success": True, "lojas": lojas})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@cadastro_login_bp.route("/api/auth/validar", methods=["POST"])
def validar_token():
    token = extrair_token(request)
    if not token:
        return jsonify({"success": False, "error": "Token não informado."}), 400

    try:
        usuario = buscar_usuario_por_token(token)
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

    if not usuario:
        return jsonify({"success": False, "error": "Token inválido."}), 401

    level = usuario.get("level")
    redirect = pagina_por_nivel(level)
    return jsonify({
        "success": True,
        "userid": usuario.get("userid"),
        "user": usuario.get("user"),
        "level": level,
        "storeid": _storeid_usuario(usuario),
        "redirect": redirect,
        "permissoes": construir_permissoes(usuario),
    })
