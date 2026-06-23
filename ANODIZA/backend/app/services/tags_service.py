from fastapi import HTTPException, Request

from app.core.auth import audit_event
from app.repositories import materiais_repo, tags_repo
from app.schemas.tags import MaterialTagsUpdate, RegraTagCreate, RegraTagDelete, RegraTagUpdate, TagCreate, TagDelete, TagUpdate


CATEGORIAS_VALIDAS = {"perfil", "vidro", "puxador", "insumo", "trilho", "componente", "sistema", "outro"}
UNIDADES_VALIDAS = {"unidade", "metro_linear", "metro_quadrado", "kit", "par"}


def listar(empresa_id: str):
    return {
        "tags": tags_repo.listar_tags(empresa_id),
        "material_tags": tags_repo.listar_material_tags(empresa_id),
        "regras": tags_repo.listar_regras(empresa_id),
    }


def criar_tag(empresa_id: str, payload: TagCreate, current_user: dict, request: Request):
    nome = payload.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome da tag")

    existente = tags_repo.buscar_tag_por_nome(empresa_id, nome)
    if existente:
        raise HTTPException(status_code=400, detail="Ja existe uma tag com este nome")

    dados = {
        "empresa_id": empresa_id,
        "nome": nome,
        "descricao": payload.descricao.strip(),
        # Tag é uma característica livre. A categoria é definida no uso da regra,
        # não na criação da tag. Mantemos a coluna para compatibilidade histórica.
        "categorias_aplicaveis": [],
        "ativo": payload.ativo,
    }
    tag = tags_repo.criar_tag(dados)
    if not tag:
        raise HTTPException(status_code=400, detail="Tag nao criada")

    audit_event(current_user, "criar", "tag", tag.get("id"), None, tag, request)
    return tag


def editar_tag(empresa_id: str, payload: TagUpdate, current_user: dict, request: Request):
    anterior = tags_repo.buscar_tag(empresa_id, payload.id)
    if not anterior:
        raise HTTPException(status_code=400, detail="Tag nao encontrada")

    nome = payload.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome da tag")

    existente = tags_repo.buscar_tag_por_nome(empresa_id, nome)
    if existente and str(existente.get("id")) != str(payload.id):
        raise HTTPException(status_code=400, detail="Ja existe uma tag com este nome")

    dados = {
        "nome": nome,
        "descricao": payload.descricao.strip(),
        "categorias_aplicaveis": [],
        "ativo": payload.ativo,
    }
    tag = tags_repo.editar_tag(empresa_id, payload.id, dados)
    if not tag:
        raise HTTPException(status_code=400, detail="Tag nao atualizada")

    audit_event(current_user, "editar", "tag", payload.id, anterior, tag, request)
    return tag


def excluir_tag(empresa_id: str, payload: TagDelete, current_user: dict, request: Request):
    anterior = tags_repo.buscar_tag(empresa_id, payload.id)
    if not anterior:
        raise HTTPException(status_code=400, detail="Tag nao encontrada")

    tag = tags_repo.excluir_tag(empresa_id, payload.id)
    audit_event(current_user, "excluir", "tag", payload.id, anterior, None, request)
    return {"ok": True, "tag": tag or anterior}


def atualizar_tags_material(empresa_id: str, payload: MaterialTagsUpdate, current_user: dict, request: Request):
    material = materiais_repo.buscar_material(empresa_id, payload.material_id)
    if not material:
        raise HTTPException(status_code=400, detail="Material nao encontrado")

    for tag_id in payload.tag_ids:
        tag = tags_repo.buscar_tag(empresa_id, tag_id)
        if not tag:
            raise HTTPException(status_code=400, detail="Tag informada nao existe")

    anterior = tags_repo.listar_tags_do_material(empresa_id, payload.material_id)
    vinculos = tags_repo.substituir_tags_material(empresa_id, payload.material_id, payload.tag_ids)
    audit_event(current_user, "alterar_tags", "material", payload.material_id, anterior, vinculos, request)
    return vinculos


def criar_regra(empresa_id: str, payload: RegraTagCreate, current_user: dict, request: Request):
    nome = payload.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome da regra")

    existente = tags_repo.buscar_regra_por_nome(empresa_id, nome)
    if existente:
        raise HTTPException(status_code=400, detail="Ja existe uma regra com este nome")

    dados = montar_dados_regra(empresa_id, payload)
    regra = tags_repo.criar_regra(dados)
    if not regra:
        raise HTTPException(status_code=400, detail="Regra nao criada")

    audit_event(current_user, "criar", "tag_regra", regra.get("id"), None, regra, request)
    return regra


def editar_regra(empresa_id: str, payload: RegraTagUpdate, current_user: dict, request: Request):
    anterior = tags_repo.buscar_regra(empresa_id, payload.id)
    if not anterior:
        raise HTTPException(status_code=400, detail="Regra nao encontrada")

    nome = payload.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome da regra")

    existente = tags_repo.buscar_regra_por_nome(empresa_id, nome)
    if existente and str(existente.get("id")) != str(payload.id):
        raise HTTPException(status_code=400, detail="Ja existe uma regra com este nome")

    dados = montar_dados_regra(empresa_id, payload)
    dados.pop("empresa_id", None)
    regra = tags_repo.editar_regra(empresa_id, payload.id, dados)
    if not regra:
        raise HTTPException(status_code=400, detail="Regra nao atualizada")

    audit_event(current_user, "editar", "tag_regra", payload.id, anterior, regra, request)
    return regra


def excluir_regra(empresa_id: str, payload: RegraTagDelete, current_user: dict, request: Request):
    anterior = tags_repo.buscar_regra(empresa_id, payload.id)
    if not anterior:
        raise HTTPException(status_code=400, detail="Regra nao encontrada")

    regra = tags_repo.excluir_regra(empresa_id, payload.id)
    audit_event(current_user, "excluir", "tag_regra", payload.id, anterior, None, request)
    return {"ok": True, "regra": regra or anterior}


def montar_dados_regra(empresa_id: str, payload: RegraTagCreate):
    validar_categoria(payload.categoria_a)
    validar_categoria(payload.categoria_b)
    validar_tags_da_regra(empresa_id, payload.tag_ids_a)
    validar_tags_da_regra(empresa_id, payload.tag_ids_b)

    cobranca_nome = payload.cobranca_nome.strip() or payload.nome.strip()

    if payload.unidade_calculo not in UNIDADES_VALIDAS:
        raise HTTPException(status_code=400, detail="Unidade de calculo invalida")

    return {
        "empresa_id": empresa_id,
        "nome": payload.nome.strip(),
        "descricao": payload.descricao.strip(),
        "categoria_a": payload.categoria_a,
        "tag_ids_a": payload.tag_ids_a,
        "categoria_b": payload.categoria_b,
        "tag_ids_b": payload.tag_ids_b,
        "operador": payload.operador,
        "cobranca_nome": cobranca_nome,
        "unidade_calculo": payload.unidade_calculo,
        "valor_unitario": round(float(payload.valor_unitario or 0), 2),
        "ativo": payload.ativo,
        "configuracao": payload.configuracao or {},
    }


def validar_categoria(categoria: str):
    if categoria not in CATEGORIAS_VALIDAS:
        raise HTTPException(status_code=400, detail="Categoria invalida")


def validar_tags_da_regra(empresa_id: str, tag_ids: list[str]):
    for tag_id in tag_ids or []:
        tag = tags_repo.buscar_tag(empresa_id, tag_id)
        if not tag:
            raise HTTPException(status_code=400, detail="Tag da regra nao encontrada")