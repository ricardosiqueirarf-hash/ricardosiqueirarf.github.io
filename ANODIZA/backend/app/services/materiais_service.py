from fastapi import HTTPException, Request

from app.core.auth import audit_event
from app.repositories import materiais_repo
from app.schemas.materiais import MaterialCreate, MaterialDelete, MaterialUpdate


TIPOLOGIAS_VALIDAS = {"giro", "deslizante", "divisao_ambiente", "pivotante", "estrutural", "prateleiras"}
CATEGORIAS_AGREGAVEIS = {"perfil", "vidro", "puxador", "insumo", "trilho", "componente", "sistema", "outro"}


def calcular_preco(custo: float, margem: float, perda: float) -> float:
    preco = float(custo or 0) * (1 + float(perda or 0) / 100) * (1 + float(margem or 0) / 100)
    return round(preco, 2)


def listar(empresa_id: str, categoria: str | None = None, ativos_apenas: bool = False):
    return materiais_repo.listar_materiais(empresa_id, categoria=categoria or None, ativos_apenas=ativos_apenas)


def criar(empresa_id: str, payload: MaterialCreate, current_user: dict, request: Request):
    nome = payload.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do material")

    configuracao = validar_configuracao(empresa_id, payload.categoria, payload.configuracao)
    existente = materiais_repo.buscar_por_nome_categoria(empresa_id, payload.categoria, nome)
    if existente:
        raise HTTPException(status_code=400, detail="Ja existe um material com este nome nesta categoria")

    dados = montar_dados(empresa_id, payload, configuracao)
    material = materiais_repo.criar_material(dados)

    if not material:
        raise HTTPException(status_code=400, detail="Material nao criado")

    audit_event(current_user, "criar", "material", material.get("id"), None, material, request)
    return material


def editar(empresa_id: str, payload: MaterialUpdate, current_user: dict, request: Request):
    anterior = materiais_repo.buscar_material(empresa_id, payload.id)
    if not anterior:
        raise HTTPException(status_code=400, detail="Material nao encontrado")

    nome = payload.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do material")

    existente = materiais_repo.buscar_por_nome_categoria(empresa_id, payload.categoria, nome)
    if existente and str(existente.get("id")) != str(payload.id):
        raise HTTPException(status_code=400, detail="Ja existe um material com este nome nesta categoria")

    configuracao = validar_configuracao(empresa_id, payload.categoria, payload.configuracao)
    dados = montar_dados(empresa_id, payload, configuracao)
    dados.pop("empresa_id", None)

    material = materiais_repo.editar_material(empresa_id, payload.id, dados)
    if not material:
        raise HTTPException(status_code=400, detail="Material nao atualizado")

    audit_event(current_user, "editar", "material", payload.id, anterior, material, request)
    return material


def excluir(empresa_id: str, payload: MaterialDelete, current_user: dict, request: Request):
    anterior = materiais_repo.buscar_material(empresa_id, payload.id)
    if not anterior:
        raise HTTPException(status_code=400, detail="Material nao encontrado")

    material = materiais_repo.excluir_material(empresa_id, payload.id)
    audit_event(current_user, "excluir", "material", payload.id, anterior, None, request)
    return {"ok": True, "material": material or anterior}


def montar_dados(empresa_id: str, payload: MaterialCreate, configuracao: dict):
    custo = round(float(payload.custo_unitario or 0), 2)
    margem = round(float(payload.margem_percentual or 0), 2)
    perda = round(float(payload.perda_percentual or 0), 2)

    return {
        "empresa_id": empresa_id,
        "categoria": payload.categoria,
        "nome": payload.nome.strip(),
        "codigo": payload.codigo.strip(),
        "unidade": payload.unidade,
        "custo_unitario": custo,
        "margem_percentual": margem,
        "perda_percentual": perda,
        "preco_unitario": calcular_preco(custo, margem, perda),
        "ativo": payload.ativo,
        "configuracao": configuracao,
    }


def validar_configuracao(empresa_id: str, categoria: str, configuracao: dict):
    config = dict(configuracao or {})
    agregados = dict(config.get("agregados") or {})

    if categoria == "perfil":
        tipologias = [t for t in config.get("tipologias", []) if t in TIPOLOGIAS_VALIDAS]
        if not tipologias:
            raise HTTPException(status_code=400, detail="Selecione ao menos uma tipologia para o perfil")

        insumos_ids = validar_materiais_relacionados(empresa_id, config.get("insumos_ids", []), categorias_validas={"insumo", "trilho", "componente", "outro"})
        puxadores_ids = validar_materiais_relacionados(empresa_id, config.get("puxadores_ids", []), categorias_validas={"puxador"})

        config["tipologias"] = tipologias
        config["insumos_ids"] = insumos_ids
        config["puxadores_ids"] = puxadores_ids
        agregados["puxador"] = puxadores_ids

    if categoria == "sistema":
        trilhos_ids = validar_materiais_relacionados(empresa_id, config.get("trilhos_ids", []), categorias_validas={"trilho"})
        perfis_ids = validar_materiais_relacionados(empresa_id, config.get("perfis_ids", []), categorias_validas={"perfil"})

        config["trilhos_ids"] = trilhos_ids
        config["perfis_ids"] = perfis_ids
        agregados["trilho"] = trilhos_ids
        agregados["perfil"] = perfis_ids

    config["agregados"] = validar_agregados(empresa_id, agregados)
    return config


def validar_agregados(empresa_id: str, agregados: dict):
    agregados_validos: dict[str, list[str]] = {}
    for categoria, ids in (agregados or {}).items():
        categoria_texto = str(categoria or "").strip()
        if categoria_texto not in CATEGORIAS_AGREGAVEIS:
            continue
        ids_validos = validar_materiais_relacionados(empresa_id, ids or [], categorias_validas={categoria_texto})
        if ids_validos:
            agregados_validos[categoria_texto] = ids_validos
    return agregados_validos


def validar_materiais_relacionados(empresa_id: str, ids: list[str], categorias_validas: set[str]):
    ids_validos: list[str] = []

    for material_id in ids or []:
        material = materiais_repo.buscar_material(empresa_id, str(material_id))
        if not material:
            raise HTTPException(status_code=400, detail="Material relacionado nao encontrado")
        if material.get("categoria") not in categorias_validas:
            raise HTTPException(status_code=400, detail="Material relacionado possui categoria invalida")
        material_id_str = str(material_id)
        if material_id_str not in ids_validos:
            ids_validos.append(material_id_str)

    return ids_validos
