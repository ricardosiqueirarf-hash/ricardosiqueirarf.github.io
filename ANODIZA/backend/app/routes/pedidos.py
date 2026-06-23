from fastapi import APIRouter, Depends, Query, Request

from app.core.auth import assert_same_company, require_permission
from app.schemas.pedidos import PedidoAprovar, PedidoCreate, PedidoProdutoCreate, PedidoStatusUpdate, PedidoUpdate
from app.services import pedidos_service

router = APIRouter()


@router.get("/orcamentos")
def listar_orcamentos(
    empresa_slug: str = Query(default=""),
    busca: str = Query(default=""),
    limit: int = Query(default=500, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(require_permission("orcamentos")),
):
    empresa_id = assert_same_company(current_user, empresa_slug=empresa_slug)
    return pedidos_service.listar(empresa_id, busca, limit=limit, offset=offset)


@router.post("/orcamentos")
def criar_orcamento(payload: PedidoCreate, request: Request, current_user: dict = Depends(require_permission("orcamentos"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return pedidos_service.criar(empresa_id, payload, current_user, request)


@router.post("/orcamentos/editar")
def editar_orcamento(payload: PedidoUpdate, request: Request, current_user: dict = Depends(require_permission("orcamentos"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return pedidos_service.editar(empresa_id, payload, current_user, request)


@router.post("/orcamentos/aprovar")
def aprovar_orcamento(payload: PedidoAprovar, request: Request, current_user: dict = Depends(require_permission("orcamentos"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return pedidos_service.aprovar(empresa_id, payload, current_user, request)


@router.post("/orcamentos/status")
def atualizar_status_orcamento(payload: PedidoStatusUpdate, request: Request, current_user: dict = Depends(require_permission("orcamentos"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return pedidos_service.atualizar_status(empresa_id, payload, current_user, request)


@router.get("/orcamentos/produtos")
def listar_produtos_orcamento(
    empresa_slug: str = Query(default=""),
    orcamento_id: str = Query(default=""),
    limit: int = Query(default=500, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(require_permission("orcamentos")),
):
    empresa_id = assert_same_company(current_user, empresa_slug=empresa_slug)
    return pedidos_service.listar_linhas(empresa_id, orcamento_id, limit=limit, offset=offset)


@router.post("/orcamentos/produtos")
def cadastrar_produto_orcamento(payload: PedidoProdutoCreate, request: Request, current_user: dict = Depends(require_permission("orcamentos"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return pedidos_service.criar_linha(empresa_id, payload, current_user, request)
