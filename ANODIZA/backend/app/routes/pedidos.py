from fastapi import APIRouter, Depends, Query

from app.core.auth import assert_same_company, require_permission
from app.services import pedidos_service

router = APIRouter()


@router.get("/orcamentos")
def listar_orcamentos(empresa_slug: str = Query(default=""), busca: str = Query(default=""), current_user: dict = Depends(require_permission("orcamentos"))):
    empresa_id = assert_same_company(current_user, empresa_slug=empresa_slug)
    return pedidos_service.listar(empresa_id, busca)
