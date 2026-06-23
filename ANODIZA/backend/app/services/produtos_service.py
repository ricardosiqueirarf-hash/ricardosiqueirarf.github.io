from fastapi import HTTPException, Request

from app.core.auth import audit_event
from app.repositories import materiais_repo, pedidos_repo, produtos_repo, tags_repo
from app.schemas.produtos import (
    ProdutoConfiguravelCalculo,
    ProdutoConfiguravelCreate,
    ProdutoConfiguravelDelete,
    ProdutoConfiguravelOrcamentoCreate,
    ProdutoConfiguravelUpdate,
)


UNIDADE_TEXTO = {
    "unidade": "un",
    "quantidade": "un",
    "area": "m²",
    "perimetro": "m",
    "largura_m": "m",
    "altura_m": "m",
    "campo_numero": "un",
    "campo_mm_para_m": "m",
    "metro_linear": "m",
    "metro_quadrado": "m²",
    "kit": "kit",
    "par": "par",
}

SNAPSHOT_SCHEMA = "orcamento_produto_v1"


def listar(empresa_id: str, ativos_apenas: bool = False):
    return produtos_repo.listar(empresa_id, ativos_apenas=ativos_apenas)


def criar(empresa_id: str, payload: ProdutoConfiguravelCreate, current_user: dict, request: Request):
    nome = payload.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do produto")
    existente = produtos_repo.buscar_por_nome(empresa_id, nome)
    if existente:
        raise HTTPException(status_code=400, detail="Ja existe um produto com este nome")
    produto = produtos_repo.criar({
        "empresa_id": empresa_id,
        "nome": nome,
        "descricao": payload.descricao.strip(),
        "ativo": payload.ativo,
        "configuracao": payload.configuracao,
    })
    if not produto:
        raise HTTPException(status_code=400, detail="Produto nao criado")
    audit_event(current_user, "criar", "produto_configuravel", produto.get("id"), None, produto, request)
    return produto


def editar(empresa_id: str, payload: ProdutoConfiguravelUpdate, current_user: dict, request: Request):
    anterior = produtos_repo.buscar(empresa_id, payload.id)
    if not anterior:
        raise HTTPException(status_code=400, detail="Produto nao encontrado")
    nome = payload.nome.strip()
    existente = produtos_repo.buscar_por_nome(empresa_id, nome)
    if existente and str(existente.get("id")) != str(payload.id):
        raise HTTPException(status_code=400, detail="Ja existe um produto com este nome")
    produto = produtos_repo.editar(empresa_id, payload.id, {
        "nome": nome,
        "descricao": payload.descricao.strip(),
        "ativo": payload.ativo,
        "configuracao": payload.configuracao,
    })
    if not produto:
        raise HTTPException(status_code=400, detail="Produto nao atualizado")
    audit_event(current_user, "editar", "produto_configuravel", payload.id, anterior, produto, request)
    return produto


def excluir(empresa_id: str, payload: ProdutoConfiguravelDelete, current_user: dict, request: Request):
    anterior = produtos_repo.buscar(empresa_id, payload.id)
    if not anterior:
        raise HTTPException(status_code=400, detail="Produto nao encontrado")
    produto = produtos_repo.excluir(empresa_id, payload.id)
    audit_event(current_user, "excluir", "produto_configuravel", payload.id, anterior, None, request)
    return {"ok": True, "produto": produto or anterior}


def calcular(empresa_id: str, payload: ProdutoConfiguravelCalculo):
    produto = produtos_repo.buscar(empresa_id, payload.produto_id)
    if not produto:
        raise HTTPException(status_code=400, detail="Produto nao encontrado")
    if not produto.get("ativo"):
        raise HTTPException(status_code=400, detail="Produto inativo")
    return calcular_produto(empresa_id, produto, payload.valores, payload.quantidade)


def adicionar_ao_orcamento(empresa_id: str, payload: ProdutoConfiguravelOrcamentoCreate, current_user: dict, request: Request):
    pedido = pedidos_repo.buscar(empresa_id, payload.orcamento_id)
    if not pedido:
        raise HTTPException(status_code=400, detail="Orcamento nao encontrado")
    calculo = calcular(empresa_id, payload)
    dados_linha = {
        "orcamento_id": payload.orcamento_id,
        "nome": calculo["nome"],
        "quantidade": payload.quantidade,
        "valor_unitario": calculo["valor_unitario"],
        "valor_total": calculo["valor_total"],
        "dados": montar_snapshot_orcamento_local(payload, calculo),
    }
    linha = pedidos_repo.inserir_linha(empresa_id, dados_linha)
    if not linha:
        raise HTTPException(status_code=400, detail="Produto nao adicionado ao orcamento")
    pedidos_total = sum(float(item.get("valor_total") or 0) for item in pedidos_repo.listar_linhas(empresa_id, payload.orcamento_id, limit=5000, offset=0))
    pedidos_repo.atualizar_total(empresa_id, payload.orcamento_id, pedidos_total)
    audit_event(current_user, "adicionar", "orcamento_produto_configuravel", linha.get("id"), None, linha, request)
    return linha


def calcular_produto(empresa_id: str, produto: dict, valores: dict, quantidade: float):
    config = produto.get("configuracao") or {}
    campos = config.get("campos") or []
    componentes = config.get("componentes") or []
    valores = valores or {}
    qtd = float(quantidade or 1)
    validar_campos(campos, valores)

    medidas = calcular_medidas(config, valores)
    materiais_cache = carregar_materiais_campos(empresa_id, campos, valores)
    validar_dependencias_material(campos, materiais_cache)

    linhas = []
    valor_unitario = 0.0
    custo_unitario = 0.0

    for componente in componentes:
        origem = componente.get("origem")
        if origem == "campo_material":
            linha = calcular_componente_material(componente, materiais_cache, valores, medidas)
            if linha:
                linhas.append(linha)
                valor_unitario += linha["total"]
                custo_unitario += linha.get("custo_total", 0)
        elif origem == "insumos_do_material":
            for linha in calcular_insumos_do_material(empresa_id, componente, materiais_cache, valores, medidas):
                linhas.append(linha)
                valor_unitario += linha["total"]
                custo_unitario += linha.get("custo_total", 0)
        elif origem == "tag_regras":
            for linha in calcular_tag_regras(empresa_id, materiais_cache, medidas):
                linhas.append(linha)
                valor_unitario += linha["total"]
                custo_unitario += linha.get("custo_total", 0)
        elif origem == "valor_adicional":
            linha = calcular_valor_adicional(componente, valores)
            if linha:
                linhas.append(linha)
                valor_unitario += linha["total"]
                custo_unitario += linha.get("custo_total", 0)

    valor_unitario = round(valor_unitario, 2)
    custo_unitario = round(custo_unitario, 2)
    valor_total = round(valor_unitario * qtd, 2)
    custo_total = round(custo_unitario * qtd, 2)
    margem = round(valor_total - custo_total, 2)
    margem_percentual = round((margem / valor_total * 100) if valor_total and custo_total else 0, 2)

    return {
        "produto_id": produto.get("id"),
        "produto_versao_id": produto.get("produto_versao_id") or produto.get("versao_atual_id"),
        "produto_origem": "local",
        "nome": produto.get("nome"),
        "quantidade": qtd,
        "valor_unitario": valor_unitario,
        "valor_total": valor_total,
        "custo_unitario": custo_unitario,
        "custo_total": custo_total,
        "margem": margem,
        "margem_percentual": margem_percentual,
        "medidas": medidas,
        "linhas": linhas,
        "configuracao_snapshot": config,
        "materiais_snapshot": materiais_snapshot(linhas),
    }


def montar_snapshot_orcamento_local(payload: ProdutoConfiguravelOrcamentoCreate, calculo: dict):
    return {
        "snapshot_schema": SNAPSHOT_SCHEMA,
        "produto_origem": "local",
        "produto_id": calculo.get("produto_id") or payload.produto_id,
        "produto_versao_id": calculo.get("produto_versao_id"),
        "produto_configuravel_id": payload.produto_id,
        "nome_produto_snapshot": calculo.get("nome"),
        "valores": payload.valores,
        "configuracao_snapshot": calculo.get("configuracao_snapshot") or {},
        "materiais_snapshot": calculo.get("materiais_snapshot") or [],
        "calculo_snapshot": calculo,
        "calculo": calculo,
        "custo_total": calculo.get("custo_total", 0),
        "margem": calculo.get("margem", 0),
        "margem_percentual": calculo.get("margem_percentual", 0),
    }


def materiais_snapshot(linhas: list[dict]):
    snapshot = []
    for linha in linhas:
        material_id = linha.get("material_id")
        if not material_id:
            continue
        snapshot.append({
            "material_id": material_id,
            "nome": linha.get("material"),
            "origem_linha": linha.get("origem"),
            "quantidade": linha.get("quantidade"),
            "unidade": linha.get("unidade"),
            "valor_unitario": linha.get("valor_unitario"),
            "custo_unitario": linha.get("custo_unitario", 0),
            "valor_total": linha.get("total"),
            "custo_total": linha.get("custo_total", 0),
        })
    return snapshot


def validar_campos(campos: list[dict], valores: dict):
    pendencias = []
    for campo in campos:
        chave = campo.get("chave")
        if campo.get("obrigatorio") and not valores.get(chave) and valores.get(chave) != 0:
            pendencias.append(campo.get("rotulo") or chave)
    if pendencias:
        raise HTTPException(status_code=400, detail=f"Preencha os campos obrigatorios: {', '.join(pendencias)}")


def calcular_medidas(config: dict, valores: dict):
    medidas_cfg = config.get("medidas") or {}
    largura_key = medidas_cfg.get("largura") or "largura"
    altura_key = medidas_cfg.get("altura") or "altura"
    largura_mm = float(valores.get(largura_key) or 0)
    altura_mm = float(valores.get(altura_key) or 0)
    largura_m = largura_mm / 1000
    altura_m = altura_mm / 1000
    return {
        "largura_mm": largura_mm,
        "altura_mm": altura_mm,
        "largura_m": largura_m,
        "altura_m": altura_m,
        "area": largura_m * altura_m,
        "perimetro": 2 * (largura_m + altura_m),
    }


def carregar_materiais_campos(empresa_id: str, campos: list[dict], valores: dict):
    cache = {}
    for campo in campos:
        if campo.get("tipo") != "material":
            continue
        chave = campo.get("chave")
        material_id = str(valores.get(chave) or "")
        if not material_id or material_id == "sem_item":
            continue
        material = materiais_repo.buscar_material(empresa_id, material_id)
        if not material:
            raise HTTPException(status_code=400, detail=f"Material invalido no campo {campo.get('rotulo') or chave}")
        categoria_esperada = campo.get("categoria")
        if categoria_esperada and material.get("categoria") != categoria_esperada:
            raise HTTPException(status_code=400, detail=f"Material de categoria invalida em {campo.get('rotulo') or chave}")
        cache[chave] = material
    return cache


def validar_dependencias_material(campos: list[dict], materiais_cache: dict):
    for campo in campos:
        if campo.get("tipo") != "material" or not campo.get("usar_agregados"):
            continue
        chave = campo.get("chave")
        depende_de = campo.get("depende_de")
        categoria = campo.get("categoria")
        material = materiais_cache.get(chave)
        material_base = materiais_cache.get(depende_de)
        if not material or not material_base:
            continue
        ids = ids_agregados(material_base, categoria)
        if str(material.get("id")) not in ids:
            raise HTTPException(status_code=400, detail=f"{material.get('nome')} nao esta agregado a {material_base.get('nome')}")


def ids_agregados(material: dict, categoria: str | None):
    if not categoria:
        return []
    config = material.get("configuracao") or {}
    agregados = config.get("agregados") or {}
    ids = agregados.get(categoria) or []
    if categoria == "puxador" and not ids:
        ids = config.get("puxadores_ids") or []
    if categoria == "trilho" and not ids:
        ids = config.get("trilhos_ids") or []
    if categoria == "perfil" and not ids:
        ids = config.get("perfis_ids") or []
    return [str(item) for item in ids or []]


def calcular_componente_material(componente: dict, materiais_cache: dict, valores: dict, medidas: dict):
    campo_material = componente.get("campo_material") or componente.get("campo_origem")
    material = materiais_cache.get(campo_material)
    if not material:
        return None
    quantidade = quantidade_por_base(componente, valores, medidas)
    if quantidade <= 0:
        return None
    preco = float(material.get("preco_unitario") or 0)
    custo = float(material.get("custo_unitario") or 0)
    total = preco * quantidade
    custo_total = custo * quantidade
    return linha_calculo(componente.get("nome") or material.get("nome"), material.get("nome"), quantidade, componente.get("base_quantidade"), preco, total, material.get("id"), custo, custo_total)


def calcular_insumos_do_material(empresa_id: str, componente: dict, materiais_cache: dict, valores: dict, medidas: dict):
    campo_material = componente.get("campo_material") or componente.get("campo_origem")
    material = materiais_cache.get(campo_material)
    if not material:
        return []
    ids = ((material.get("configuracao") or {}).get("insumos_ids") or [])
    linhas = []
    for insumo_id in ids:
        insumo = materiais_repo.buscar_material(empresa_id, str(insumo_id))
        if not insumo:
            continue
        quantidade = quantidade_por_unidade_material(insumo, componente, valores, medidas)
        preco = float(insumo.get("preco_unitario") or 0)
        custo = float(insumo.get("custo_unitario") or 0)
        total = preco * quantidade
        custo_total = custo * quantidade
        if quantidade > 0:
            linhas.append(linha_calculo(componente.get("nome") or "Insumo do material", insumo.get("nome"), quantidade, componente.get("base_quantidade"), preco, total, insumo.get("id"), custo, custo_total))
    return linhas


def calcular_tag_regras(empresa_id: str, materiais_cache: dict, medidas: dict):
    if len(materiais_cache) < 2:
        return []
    material_tags = tags_repo.listar_material_tags(empresa_id)
    tags_por_material = {}
    for item in material_tags:
        tags_por_material.setdefault(str(item.get("material_id")), set()).add(str(item.get("tag_id")))

    regras = tags_repo.listar_regras(empresa_id, ativos_apenas=True)
    linhas = []
    materiais = list(materiais_cache.values())
    for regra in regras:
        for material_a in materiais:
            if material_a.get("categoria") != regra.get("categoria_a"):
                continue
            for material_b in materiais:
                if material_b.get("id") == material_a.get("id") or material_b.get("categoria") != regra.get("categoria_b"):
                    continue
                if regra_casa(regra, material_a, material_b, tags_por_material):
                    quantidade = quantidade_por_unidade_regra(regra, medidas)
                    valor_unitario = float(regra.get("valor_unitario") or 0)
                    total = valor_unitario * quantidade
                    linhas.append({
                        "nome": regra.get("cobranca_nome") or regra.get("nome"),
                        "origem": "tag_regra",
                        "material": f"{material_a.get('nome')} + {material_b.get('nome')}",
                        "quantidade": round(quantidade, 4),
                        "unidade": unidade_texto_regra(regra.get("unidade_calculo")),
                        "valor_unitario": round(valor_unitario, 2),
                        "total": round(total, 2),
                        "custo_unitario": 0,
                        "custo_total": 0,
                        "regra_id": regra.get("id"),
                    })
    return linhas


def regra_casa(regra: dict, material_a: dict, material_b: dict, tags_por_material: dict):
    tags_a = tags_por_material.get(str(material_a.get("id")), set())
    tags_b = tags_por_material.get(str(material_b.get("id")), set())
    regra_tags_a = {str(item) for item in (regra.get("tag_ids_a") or [])}
    regra_tags_b = {str(item) for item in (regra.get("tag_ids_b") or [])}
    operador = regra.get("operador") or "contem_todas"
    return tags_casam(tags_a, regra_tags_a, operador) and tags_casam(tags_b, regra_tags_b, operador)


def tags_casam(tags_material: set[str], tags_regra: set[str], operador: str):
    if not tags_regra:
        return True
    if operador == "contem_qualquer":
        return bool(tags_material.intersection(tags_regra))
    return tags_regra.issubset(tags_material)


def calcular_valor_adicional(componente: dict, valores: dict):
    campo = componente.get("campo_origem") or "valor_adicional"
    valor = float(valores.get(campo) or 0)
    if valor <= 0:
        return None
    return {
        "nome": componente.get("nome") or "Valor adicional",
        "origem": "valor_adicional",
        "material": "Manual",
        "quantidade": 1,
        "unidade": "un",
        "valor_unitario": round(valor, 2),
        "total": round(valor, 2),
        "custo_unitario": 0,
        "custo_total": 0,
    }


def quantidade_por_base(componente: dict, valores: dict, medidas: dict):
    base = componente.get("base_quantidade") or "unidade"
    multiplicador = float(componente.get("multiplicador") or 1)
    if base == "area":
        return medidas.get("area", 0) * multiplicador
    if base == "perimetro":
        return medidas.get("perimetro", 0) * multiplicador
    if base == "largura_m":
        return medidas.get("largura_m", 0) * multiplicador
    if base == "altura_m":
        return medidas.get("altura_m", 0) * multiplicador
    if base == "campo_numero":
        return float(valores.get(componente.get("campo_origem")) or 0) * multiplicador
    if base == "campo_mm_para_m":
        return (float(valores.get(componente.get("campo_origem")) or 0) / 1000) * multiplicador
    if base == "quantidade":
        return float(valores.get("quantidade") or 1) * multiplicador
    return 1 * multiplicador


def quantidade_por_unidade_material(material: dict, componente: dict, valores: dict, medidas: dict):
    unidade = material.get("unidade")
    if unidade == "metro_linear":
        return medidas.get("perimetro", 0) * float(componente.get("multiplicador") or 1)
    if unidade == "metro_quadrado":
        return medidas.get("area", 0) * float(componente.get("multiplicador") or 1)
    return 1 * float(componente.get("multiplicador") or 1)


def quantidade_por_unidade_regra(regra: dict, medidas: dict):
    unidade = regra.get("unidade_calculo")
    if unidade == "metro_linear":
        return medidas.get("perimetro", 0)
    if unidade == "metro_quadrado":
        return medidas.get("area", 0)
    return 1


def unidade_texto_regra(unidade: str):
    if unidade == "metro_linear":
        return "m"
    if unidade == "metro_quadrado":
        return "m²"
    return UNIDADE_TEXTO.get(unidade, unidade or "un")


def linha_calculo(nome: str, material_nome: str, quantidade: float, base: str, preco: float, total: float, material_id: str | None = None, custo: float = 0, custo_total: float = 0):
    return {
        "nome": nome,
        "origem": "material",
        "material": material_nome,
        "material_id": material_id,
        "quantidade": round(float(quantidade or 0), 4),
        "unidade": UNIDADE_TEXTO.get(base or "unidade", "un"),
        "valor_unitario": round(float(preco or 0), 2),
        "total": round(float(total or 0), 2),
        "custo_unitario": round(float(custo or 0), 2),
        "custo_total": round(float(custo_total or 0), 2),
    }
