from fastapi import APIRouter, Depends, Query, Request

from app.core.auth import assert_same_company, require_master
from app.schemas.colaboradores import ColaboradorCreate, ColaboradorPermissoesUpdate
from app.services import colaboradores_service

router = APIRouter()


@router.get("/usuarios")
def listar_usuarios(empresa_slug: str = Query(default=""), current_user: dict = Depends(require_master)):
    empresa_id = assert_same_company(current_user, empresa_slug=empresa_slug)
    return colaboradores_service.listar(empresa_id)


@router.post("/usuarios")
def criar_usuario(payload: ColaboradorCreate, request: Request, current_user: dict = Depends(require_master)):
    assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return colaboradores_service.criar(payload, current_user, request)


@router.post("/usuarios/permissoes")
def editar_permissoes_usuario(payload: ColaboradorPermissoesUpdate, request: Request, current_user: dict = Depends(require_master)):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return colaboradores_service.alterar_acessos(empresa_id, payload, current_user, request)
