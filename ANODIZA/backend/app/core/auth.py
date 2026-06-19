import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Callable

from fastapi import Depends, Header, HTTPException, Request

from app.core.config import get_settings
from app.db.supabase_client import get_supabase

PERMISSOES_PADRAO = {
    "painel": True,
    "orcamentos": True,
    "clientes": True,
    "usuarios": False,
    "ajustes": False,
    "produtos": False,
    "materiais": False,
}

PERMISSOES_MASTER = {
    "painel": True,
    "orcamentos": True,
    "clientes": True,
    "usuarios": True,
    "ajustes": True,
    "produtos": True,
    "materiais": True,
}


def generate_session_key() -> str:
    return secrets.token_urlsafe(48)


def hash_session_key(session_key: str) -> str:
    return hashlib.sha256(session_key.encode("utf-8")).hexdigest()


def normalize_permissions(permissoes, perfil: str = "vendedor") -> dict:
    base = dict(PERMISSOES_MASTER if perfil == "owner" else PERMISSOES_PADRAO)
    if isinstance(permissoes, dict):
        for chave in base:
            if chave in permissoes:
                base[chave] = bool(permissoes[chave])
    if perfil == "owner":
        return dict(PERMISSOES_MASTER)
    base["usuarios"] = False
    return base


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for") or ""
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


def create_session(usuario: dict, request: Request) -> str:
    session_key = generate_session_key()
    session_hash = hash_session_key(session_key)
    expira_em = (datetime.now(timezone.utc) + timedelta(minutes=get_settings().session_minutes)).isoformat()
    get_supabase().table("controle_sistema").insert({
        "chave_hash": session_hash,
        "pessoa": usuario["id"],
        "empresa": usuario["empresa_id"],
        "valido_ate": expira_em,
        "ip": _client_ip(request),
        "user_agent": request.headers.get("user-agent", ""),
    }).execute()
    return session_key


def audit_event(usuario: dict | None, acao: str, recurso: str, recurso_id: str | None = None, antes=None, depois=None, request: Request | None = None):
    try:
        get_supabase().table("eventos_auditoria").insert({
            "empresa_id": usuario.get("empresa_id") if usuario else None,
            "usuario_id": usuario.get("id") if usuario else None,
            "acao": acao,
            "recurso": recurso,
            "recurso_id": recurso_id,
            "antes": antes,
            "depois": depois,
            "ip": _client_ip(request) if request else "",
            "user_agent": request.headers.get("user-agent", "") if request else "",
        }).execute()
    except Exception:
        pass


def get_current_user(request: Request, x_anodiza_key: str | None = Header(default=None)) -> dict:
    if not x_anodiza_key:
        raise HTTPException(status_code=401, detail="Sessao obrigatoria")

    session_hash = hash_session_key(x_anodiza_key)
    supabase = get_supabase()
    acesso_result = (
        supabase.table("controle_sistema")
        .select("id,pessoa,empresa,valido_ate,revogado_em")
        .eq("chave_hash", session_hash)
        .limit(1)
        .execute()
    )
    if not acesso_result.data:
        audit_event(None, "acesso_negado", "sessao", None, None, {"motivo": "inexistente"}, request)
        raise HTTPException(status_code=401, detail="Sessao invalida")

    acesso = acesso_result.data[0]
    if acesso.get("revogado_em"):
        raise HTTPException(status_code=401, detail="Sessao revogada")

    expira_em = str(acesso.get("valido_ate") or "")
    if expira_em and datetime.fromisoformat(expira_em.replace("Z", "+00:00")) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Sessao expirada")

    usuario_result = (
        supabase.table("usuarios")
        .select("id,empresa_id,loja_id,nome,email,perfil,ativo,permissoes")
        .eq("id", acesso["pessoa"])
        .eq("empresa_id", acesso["empresa"])
        .eq("ativo", True)
        .limit(1)
        .execute()
    )
    if not usuario_result.data:
        raise HTTPException(status_code=401, detail="Usuario nao autorizado")

    usuario = usuario_result.data[0]
    usuario["permissoes"] = normalize_permissions(usuario.get("permissoes"), usuario.get("perfil") or "vendedor")
    try:
        supabase.table("controle_sistema").update({"ultimo_uso_em": datetime.now(timezone.utc).isoformat()}).eq("id", acesso["id"]).execute()
    except Exception:
        pass
    return usuario


def require_user(current_user: dict = Depends(get_current_user)) -> dict:
    return current_user


def require_master(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("perfil") != "owner":
        audit_event(current_user, "acesso_negado", "master", None, None, {"motivo": "nao_owner"})
        raise HTTPException(status_code=403, detail="Apenas o usuario master pode acessar esta area")
    return current_user


def require_permission(permissao: str) -> Callable:
    def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("perfil") == "owner":
            return current_user
        if not current_user.get("permissoes", {}).get(permissao):
            audit_event(current_user, "acesso_negado", permissao, None, None, {"motivo": "sem_permissao"})
            raise HTTPException(status_code=403, detail="Usuario sem permissao para este ambiente")
        return current_user

    return dependency


def assert_same_company(current_user: dict, empresa_slug: str | None = None, empresa_id: str | None = None) -> str:
    empresa_real = str(current_user.get("empresa_id") or "")
    if not empresa_real:
        raise HTTPException(status_code=401, detail="Empresa nao identificada")
    if empresa_id and str(empresa_id) != empresa_real:
        raise HTTPException(status_code=403, detail="Usuario nao pertence a esta empresa")
    if empresa_slug:
        result = get_supabase().table("empresas").select("id").eq("slug", empresa_slug).limit(1).execute()
        if not result.data:
            raise HTTPException(status_code=400, detail="Empresa nao encontrada")
        if str(result.data[0]["id"]) != empresa_real:
            raise HTTPException(status_code=403, detail="Usuario nao pertence a esta empresa")
    return empresa_real


def revoke_current_session(request: Request, x_anodiza_key: str | None = Header(default=None)) -> None:
    if not x_anodiza_key:
        return
    get_supabase().table("controle_sistema").update({"revogado_em": datetime.now(timezone.utc).isoformat()}).eq("chave_hash", hash_session_key(x_anodiza_key)).execute()
