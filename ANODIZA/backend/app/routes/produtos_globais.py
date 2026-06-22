from fastapi import APIRouter, Depends, Query, Request

from app.core.auth import assert_same_company, require_permission
from app.schemas.produtos_globais import PortaGiroAdicionar, PortaGiroPayload, ProdutoGlobalToggle
from app.services import produtos_globais_service

router = APIRouter()


@router.get("/produtos-globais")
def listar_produtos_globais(empresa_slug: str = Query(default=""), current_user: dict = Depends(require_permission("orcamentos"))):
    empresa_id = assert_same_company(current_user, empresa_slug=empresa_slug)
    return produtos_globais_service.listar(empresa_id)


@router.post("/produtos-globais/alternar")
def alternar_produto_global(payload: ProdutoGlobalToggle, request: Request, current_user: dict = Depends(require_permission("orcamentos"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return produtos_globais_service.alternar(empresa_id, payload, current_user, request)


@router.post("/produtos-globais/porta-giro/calcular")
def calcular_porta_giro(payload: PortaGiroPayload, current_user: dict = Depends(require_permission("orcamentos"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return produtos_globais_service.calcular_porta_giro(empresa_id, payload)


@router.post("/produtos-globais/porta-giro/adicionar-orcamento")
def adicionar_porta_giro(payload: PortaGiroAdicionar, request: Request, current_user: dict = Depends(require_permission("orcamentos"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return produtos_globais_service.adicionar_porta_giro(empresa_id, payload, current_user, request)
