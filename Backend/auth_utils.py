import jwt
import datetime


def gerar_token_usuario(usuario):
    from app import JWT_SECRET
    expira_em = datetime.datetime.utcnow() + datetime.timedelta(hours=12)
    payload = {
        "userid": usuario.get("userid"),
        "level": usuario.get("level"),
        "storeid": usuario.get("storeid"),
        "exp": expira_em
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def buscar_usuario_por_token(token):
    from app import JWT_SECRET
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def extrair_token(request):
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.replace("Bearer ", "", 1).strip()

    json_body = request.get_json(silent=True) or {}
    return (
        request.headers.get("X-Auth-Token")
        or request.args.get("token")
        or json_body.get("token")
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
    if level == 2:
        return "index_loja.html"
    if level == 3:
        return "index.html"
    if level == 1:
        return "index_loja.html"
    return "login.html"




