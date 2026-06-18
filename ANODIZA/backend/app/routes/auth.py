from fastapi import APIRouter, Depends, Header, HTTPException, Request

from app.core.auth import audit_event, create_session, get_current_user, revoke_current_session
from app.db.supabase_client import get_supabase

router = APIRouter()


def sanitize_user(usuario: dict) -> dict:
    return {
        "id": usuario.get("id"),
        "empresa_id": usuario.get("empresa_id"),
        "loja_id": usuario.get("loja_id"),
        "nome": usuario.get("nome"),
        "email": usuario.get("email"),
        "perfil": usuario.get("perfil"),
        "permissoes": usuario.get("permissoes"),
    }


def run_rpc(name: str, payload: dict):
    try:
        result = get_supabase().rpc(name, {"payload": payload}).execute()
    except Exception as error:
        raise HTTPException(status_code=400, detail="Operacao nao realizada") from error
    if not result.data:
        raise HTTPException(status_code=400, detail="Operacao nao realizada")
    return result.data


def issue_login_response(data: dict, request: Request):
    usuario = data.get("usuario") or {}
    if not usuario.get("id") or not usuario.get("empresa_id"):
        raise HTTPException(status_code=400, detail="Usuario nao identificado")
    chave = create_session(usuario, request)
    usuario_seguro = sanitize_user(usuario)
    audit_event(usuario_seguro, "login", "auth", usuario.get("id"), None, {"empresa_slug": data.get("empresa_slug")}, request)
    return {
        "chave_acesso": chave,
        "empresa_slug": data.get("empresa_slug"),
        "usuario": usuario_seguro,
    }


@router.post("/cadastro")
def cadastro(payload: dict, request: Request):
    return issue_login_response(run_rpc("cadastro_empresa", payload), request)


@router.post("/login")
def login(payload: dict, request: Request):
    try:
        data = run_rpc("login_empresa", payload)
    except HTTPException as error:
        raise HTTPException(status_code=401, detail="Empresa, e-mail ou senha invalidos") from error
    return issue_login_response(data, request)


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return {"ok": True, "usuario": sanitize_user(current_user)}


@router.post("/logout")
def logout(request: Request, x_anodiza_key: str | None = Header(default=None), current_user: dict = Depends(get_current_user)):
    revoke_current_session(request, x_anodiza_key)
    audit_event(current_user, "logout", "auth", current_user.get("id"), None, None, request)
    return {"ok": True}
