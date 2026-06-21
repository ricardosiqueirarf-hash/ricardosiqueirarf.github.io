from fastapi import APIRouter, Depends, Query, Request

from app.core.auth import assert_same_company, require_permission
from app.schemas.clientes import ClienteCreate, ClienteDelete, ClienteUpdate
from app.services import clientes_service

router = APIRouter()


@router.get("/clientes")
def listar_clientes(empresa_slug: str = Query(default=""), current_user: dict = Depends(require_permission("clientes"))):
    empresa_id = assert_same_company(current_user, empresa_slug=empresa_slug)
    return clientes_service.listar(empresa_id)


@router.post("/clientes")
def criar_cliente(payload: ClienteCreate, request: Request, current_user: dict = Depends(require_permission("clientes"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return clientes_service.criar(empresa_id, payload, current_user, request)


@router.post("/clientes/editar")
def editar_cliente(payload: ClienteUpdate, request: Request, current_user: dict = Depends(require_permission("clientes"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return clientes_service.editar(empresa_id, payload, current_user, request)


@router.post("/clientes/excluir")
def excluir_cliente(payload: ClienteDelete, request: Request, current_user: dict = Depends(require_permission("clientes"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return clientes_service.excluir(empresa_id, payload, current_user, request)
