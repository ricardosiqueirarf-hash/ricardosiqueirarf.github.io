from fastapi import APIRouter, Depends, Query, Request

from app.core.auth import assert_same_company, require_permission
from app.schemas.materiais import MaterialCreate, MaterialDelete, MaterialUpdate
from app.services import materiais_service

router = APIRouter()


@router.get("/materiais")
def listar_materiais(
    empresa_slug: str = Query(default=""),
    categoria: str = Query(default=""),
    ativos_apenas: bool = Query(default=False),
    current_user: dict = Depends(require_permission("materiais")),
):
    empresa_id = assert_same_company(current_user, empresa_slug=empresa_slug)
    return materiais_service.listar(empresa_id, categoria=categoria, ativos_apenas=ativos_apenas)


@router.post("/materiais")
def criar_material(payload: MaterialCreate, request: Request, current_user: dict = Depends(require_permission("materiais"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return materiais_service.criar(empresa_id, payload, current_user, request)


@router.post("/materiais/editar")
def editar_material(payload: MaterialUpdate, request: Request, current_user: dict = Depends(require_permission("materiais"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return materiais_service.editar(empresa_id, payload, current_user, request)


@router.post("/materiais/excluir")
def excluir_material(payload: MaterialDelete, request: Request, current_user: dict = Depends(require_permission("materiais"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return materiais_service.excluir(empresa_id, payload, current_user, request)
