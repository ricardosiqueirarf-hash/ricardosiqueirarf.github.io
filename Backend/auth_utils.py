import jwt
import datetime


def _nome_usuario(usuario):
    usuario = usuario or {}
    dados = usuario.get("dados") if isinstance(usuario.get("dados"), dict) else {}
    return (
        usuario.get("nome")
        or usuario.get("NOME")
        or dados.get("nome")
        or dados.get("NOME")
        or usuario.get("user")
    )


def _buscar_usuario_por_userid(userid):
    userid = str(userid or "").strip()
    if not userid:
        return None
    try:
        import requests
        from app import SUPABASE_URL, HEADERS
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/usuarios",
            headers=HEADERS,
            params={
                "select": "*",
                "userid": f"eq.{userid}",
                "limit": "1",
            },
            timeout=8,
        )
        r.raise_for_status()
        rows = r.json() or []
        return rows[0] if rows else None
    except Exception as exc:
        print(f"[AUTH] falha_enriquecer_usuario userid={userid} erro={exc}")
        return None


def gerar_token_usuario(usuario):
    from app import JWT_SECRET
    usuario = usuario or {}
    expira_em = datetime.datetime.utcnow() + datetime.timedelta(hours=12)
    payload = {
        "userid": usuario.get("userid"),
        "user": usuario.get("user"),
        "nome": _nome_usuario(usuario),
        "dados": usuario.get("dados") if isinstance(usuario.get("dados"), dict) else {},
        "level": usuario.get("level"),
        "storeid": usuario.get("storeid") or usuario.get("lojaid") or usuario.get("storeID") or usuario.get("lojaID"),
        "exp": expira_em
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def buscar_usuario_por_token(token):
    from app import JWT_SECRET
    try:
        usuario = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None

    if usuario and usuario.get("userid") and not (usuario.get("user") or usuario.get("nome") or usuario.get("dados")):
        usuario_db = _buscar_usuario_por_userid(usuario.get("userid"))
        if usuario_db:
            usuario = {
                **usuario,
                "user": usuario_db.get("user"),
                "nome": _nome_usuario(usuario_db),
                "dados": usuario_db.get("dados") if isinstance(usuario_db.get("dados"), dict) else {},
                "level": usuario_db.get("level") or usuario.get("level"),
                "storeid": usuario_db.get("storeid") or usuario_db.get("lojaid") or usuario.get("storeid"),
            }
    return usuario


def extrair_token(request):
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.replace("Bearer ", "", 1).strip()

    json_body = request.get_json(silent=True) or {}
    cookie_token = request.cookies.get("auth_token")
    return (
        request.headers.get("X-Auth-Token")
        or request.args.get("token")
        or json_body.get("token")
        or cookie_token
    )


def construir_permissoes(level):
    if level == 1:
        return ["orcamentos:loja"]
    if level == 2:
        return ["orcamentos:all"]
    if level == 3:
        return ["orcamentos:all", "admin:all"]
    return []


def pagina_por_nivel(level):
    try:
        level = int(level)
    except (TypeError, ValueError):
        level = 0

    if level == 3:
        return "index_admin.html"
    if level == 4:
        return "index_logistica.html"
    if level in (1, 2):
        return "index_loja.html"
    return "login.html"
