from fastapi import APIRouter, Depends, Request

from app.core.auth import assert_same_company, require_permission
from app.schemas.tags import MaterialTagsUpdate, RegraTagCreate, RegraTagDelete, RegraTagUpdate, TagCreate, TagDelete, TagUpdate
from app.services import tags_service

router = APIRouter()


@router.get("/tags")
def listar_tags(empresa_slug: str = "", current_user: dict = Depends(require_permission("tags"))):
    empresa_id = assert_same_company(current_user, empresa_slug=empresa_slug)
    return tags_service.listar(empresa_id)


@router.post("/tags")
def criar_tag(payload: TagCreate, request: Request, current_user: dict = Depends(require_permission("tags"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return tags_service.criar_tag(empresa_id, payload, current_user, request)


@router.post("/tags/editar")
def editar_tag(payload: TagUpdate, request: Request, current_user: dict = Depends(require_permission("tags"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return tags_service.editar_tag(empresa_id, payload, current_user, request)


@router.post("/tags/excluir")
def excluir_tag(payload: TagDelete, request: Request, current_user: dict = Depends(require_permission("tags"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return tags_service.excluir_tag(empresa_id, payload, current_user, request)


@router.post("/tags/material")
def atualizar_tags_material(payload: MaterialTagsUpdate, request: Request, current_user: dict = Depends(require_permission("tags"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return tags_service.atualizar_tags_material(empresa_id, payload, current_user, request)


@router.post("/tags/regras")
def criar_regra(payload: RegraTagCreate, request: Request, current_user: dict = Depends(require_permission("tags"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return tags_service.criar_regra(empresa_id, payload, current_user, request)


@router.post("/tags/regras/editar")
def editar_regra(payload: RegraTagUpdate, request: Request, current_user: dict = Depends(require_permission("tags"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return tags_service.editar_regra(empresa_id, payload, current_user, request)


@router.post("/tags/regras/excluir")
def excluir_regra(payload: RegraTagDelete, request: Request, current_user: dict = Depends(require_permission("tags"))):
    empresa_id = assert_same_company(current_user, empresa_slug=payload.empresa_slug)
    return tags_service.excluir_regra(empresa_id, payload, current_user, request)
