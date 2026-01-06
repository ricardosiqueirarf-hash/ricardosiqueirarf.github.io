import requests


def buscar_usuario_por_token(token):
    from app import SUPABASE_URL, HEADERS
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/usuarios",
        headers=HEADERS,
        params={
            "select": "userid,level,storeid,token",
            "token": f"eq.{token}"
        }
    )
    response.raise_for_status()
    usuarios = response.json()
    return usuarios[0] if usuarios else None


def extrair_token(request):
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.replace("Bearer ", "", 1).strip()

    return (
        request.headers.get("X-Auth-Token")
        or request.args.get("token")
        or (request.json or {}).get("token")
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
    if level == 1:
        return "loja_index.html"
    if level == 2:
        return "index_loja.html"
    if level == 3:
        return "index.html"
    return "logincadastro.html"
