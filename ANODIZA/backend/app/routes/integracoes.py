from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from app.core.auth import assert_same_company, audit_event, require_permission
from app.external_apis.conta_azul.service import ContaAzulIntegrationNotConfiguredError, ContaAzulService

router = APIRouter()


class ExportOrcamentoPayload(BaseModel):
    empresa_slug: str


@router.get("/conta-azul/status")
def conta_azul_status(
    empresa_slug: str = Query(default=""),
    current_user: dict = Depends(require_permission("ajustes")),
):
    empresa_id = assert_same_company(current_user, empresa_slug=empresa_slug)
    return ContaAzulService(empresa_id).status()


@router.post("/conta-azul/orcamentos/{orcamento_id}/exportar")
def exportar_orcamento_conta_azul(
    orcamento_id: str,
    payload: ExportOrcamentoPayload,
    request: Request,
    current_user: dict = Depends(require_permission("orcamentos")),
):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    try:
        resultado = ContaAzulService(empresa_id).export_orcamento(orcamento_id)
        audit_event(
            current_user,
            "exportar",
            "integracao_conta_azul_orcamento",
            orcamento_id,
            None,
            resultado.model_dump(),
            request,
        )
        return resultado
    except ContaAzulIntegrationNotConfiguredError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Falha ao comunicar com Conta Azul: {exc}") from exc
