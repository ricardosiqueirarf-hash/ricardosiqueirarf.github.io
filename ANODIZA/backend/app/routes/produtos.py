from fastapi import APIRouter, Depends, Query, Request

from app.core.auth import assert_same_company, require_permission
from app.schemas.produtos import (
    ProdutoConfiguravelCalculo,
    ProdutoConfiguravelCreate,
    ProdutoConfiguravelDelete,
    ProdutoConfiguravelOrcamentoCreate,
    ProdutoConfiguravelUpdate,
)
from app.services import produtos_service

router = APIRouter()


@router.get("/produtos")
def listar_produtos(
    empresa_slug: str = Query(default=""),
    ativos_apenas: bool = Query(default=False),
    current_user: dict = Depends(require_permission("produtos")),
):
    empresa_id = assert_same_company(current_user, empresa_slug=empresa_slug)
    return produtos_service.listar(empresa_id, ativos_apenas=ativos_apenas)


@router.post("/produtos")
def criar_produto(payload: ProdutoConfiguravelCreate, request: Request, current_user: dict = Depends(require_permission("produtos"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return produtos_service.criar(empresa_id, payload, current_user, request)


@router.post("/produtos/editar")
def editar_produto(payload: ProdutoConfiguravelUpdate, request: Request, current_user: dict = Depends(require_permission("produtos"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return produtos_service.editar(empresa_id, payload, current_user, request)


@router.post("/produtos/excluir")
def excluir_produto(payload: ProdutoConfiguravelDelete, request: Request, current_user: dict = Depends(require_permission("produtos"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return produtos_service.excluir(empresa_id, payload, current_user, request)


@router.post("/produtos/calcular")
def calcular_produto(payload: ProdutoConfiguravelCalculo, current_user: dict = Depends(require_permission("produtos"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return produtos_service.calcular(empresa_id, payload)


@router.post("/produtos/adicionar-orcamento")
def adicionar_produto_orcamento(payload: ProdutoConfiguravelOrcamentoCreate, request: Request, current_user: dict = Depends(require_permission("orcamentos"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return produtos_service.adicionar_ao_orcamento(empresa_id, payload, current_user, request)
