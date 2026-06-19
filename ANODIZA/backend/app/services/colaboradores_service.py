from fastapi import HTTPException, Request

from app.core.auth import audit_event, normalize_permissions
from app.repositories import colaboradores_repo
from app.repositories.common import supabase_client
from app.schemas.colaboradores import ColaboradorCreate, ColaboradorPermissoesUpdate


def listar(empresa_id: str):
    lista = []
    for item in colaboradores_repo.listar(empresa_id):
        item["permissoes"] = normalize_permissions(item.get("permissoes"), item.get("perfil") or "vendedor")
        lista.append(item)
    return lista


def criar(payload: ColaboradorCreate, current_user: dict, request: Request):
    result = supabase_client().rpc("criar_usuario_empresa", {"payload": payload.model_dump()}).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Usuario nao criado")
    audit_event(current_user, "criar", "usuario", None, None, result.data, request)
    return result.data


def alterar_acessos(empresa_id: str, payload: ColaboradorPermissoesUpdate, current_user: dict, request: Request):
    alvo = colaboradores_repo.buscar(empresa_id, payload.id)
    if not alvo:
        raise HTTPException(status_code=400, detail="Usuario nao encontrado")
    if alvo.get("perfil") == "owner":
        raise HTTPException(status_code=400, detail="O usuario master sempre tem acesso total")
    novas = normalize_permissions(payload.permissoes, alvo.get("perfil") or "vendedor")
    novas["usuarios"] = False
    result = supabase_client().table("usuarios").update({"permissoes": novas}).eq("empresa_id", empresa_id).eq("id", payload.id).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Permissoes nao atualizadas")
    audit_event(current_user, "alterar_permissoes", "usuario", payload.id, {"permissoes": alvo.get("permissoes")}, {"permissoes": novas}, request)
    return result.data[0]
