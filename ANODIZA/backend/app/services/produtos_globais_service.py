from fastapi import HTTPException, Request

from app.core.auth import audit_event
from app.repositories import materiais_repo, pedidos_repo, produtos_globais_repo, tags_repo
from app.schemas.produtos_globais import PRODUTO_PORTA_GIRO, PortaGiroAdicionar, PortaGiroPayload, ProdutoGlobalToggle


SNAPSHOT_SCHEMA = "orcamento_produto_v1"

CATALOGO_GLOBAL = [
    {
        "produto_chave": PRODUTO_PORTA_GIRO,
        "nome": "Porta de Giro",
        "classe": "Portas, divisões e prateleiras",
        "descricao": "Produto global padrão do ANODIZA para orçamento de porta de giro com alumínio, vidro, puxador e dobradiças.",
        "ordem": 1,
    }
]


def listar(empresa_id: str):
    configs = {item["produto_chave"]: item for item in produtos_globais_repo.listar_configuracoes(empresa_id)}
    lista = []
    for produto in CATALOGO_GLOBAL:
        config = configs.get(produto["produto_chave"])
        lista.append({
            **produto,
            "ativo": True if config is None else bool(config.get("ativo")),
            "configuracao": (config or {}).get("configuracao") or {},
        })
    return lista


def alternar(empresa_id: str, payload: ProdutoGlobalToggle, current_user: dict, request: Request):
    if payload.produto_chave != PRODUTO_PORTA_GIRO:
        raise HTTPException(status_code=400, detail="Produto global nao encontrado")
    anterior = produtos_globais_repo.buscar_configuracao(empresa_id, payload.produto_chave)
    config = produtos_globais_repo.upsert_configuracao(empresa_id, payload.produto_chave, payload.ativo)
    audit_event(current_user, "alternar", "produto_global", payload.produto_chave, anterior, config, request)
    return config


def produto_ativo(empresa_id: str, produto_chave: str):
    config = produtos_globais_repo.buscar_configuracao(empresa_id, produto_chave)
    return True if config is None else bool(config.get("ativo"))


def calcular_porta_giro(empresa_id: str, payload: PortaGiroPayload):
    if not produto_ativo(empresa_id, PRODUTO_PORTA_GIRO):
        raise HTTPException(status_code=400, detail="Produto Porta de Giro esta desativado para esta empresa")

    perfil = buscar_material_ativo(empresa_id, payload.perfil_id, "perfil", "perfil")
    vidro = buscar_material_ativo(empresa_id, payload.vidro_id, "vidro", "vidro")
    puxador = None
    if payload.puxador_id and payload.puxador_id != "sem_puxador":
        puxador = buscar_material_ativo(empresa_id, payload.puxador_id, "puxador", "puxador")
        validar_puxador_agregado(perfil, puxador)

    medidas = calcular_medidas(payload.largura, payload.altura)
    dobradicas_alturas = normalizar_dobradicas(payload.altura, payload.dobradicas, payload.dobradicas_alturas)

    linhas: list[dict] = []
    preco_unitario = 0.0
    custo_unitario = 0.0

    linha_perfil = montar_linha_material("Perfil", perfil, medidas["perimetro"], "m")
    linhas.append(linha_perfil)
    preco_unitario += linha_perfil["total"]
    custo_unitario += linha_perfil["custo_total"]

    linha_vidro = montar_linha_material("Vidro", vidro, medidas["area"], "m²")
    linhas.append(linha_vidro)
    preco_unitario += linha_vidro["total"]
    custo_unitario += linha_vidro["custo_total"]

    for insumo in insumos_do_perfil(empresa_id, perfil):
        qtd = quantidade_por_unidade(insumo, medidas)
        if qtd <= 0:
            continue
        linha = montar_linha_material("Insumo do perfil", insumo, qtd, unidade_texto(insumo.get("unidade")))
        linhas.append(linha)
        preco_unitario += linha["total"]
        custo_unitario += linha["custo_total"]

    if puxador:
        qtd_puxador = quantidade_puxador(puxador, payload.medida_puxador)
        linha = montar_linha_material("Puxador", puxador, qtd_puxador, unidade_texto(puxador.get("unidade")))
        linhas.append(linha)
        preco_unitario += linha["total"]
        custo_unitario += linha["custo_total"]

    for linha in calcular_regras_tags(empresa_id, [perfil, vidro] + ([puxador] if puxador else []), medidas):
        linhas.append(linha)
        preco_unitario += linha["total"]
        custo_unitario += linha.get("custo_total", 0)

    if payload.valor_adicional > 0:
        linha = {
            "nome": "Valor adicional",
            "material": "Manual",
            "quantidade": 1,
            "unidade": "un",
            "valor_unitario": round(payload.valor_adicional, 2),
            "total": round(payload.valor_adicional, 2),
            "custo_unitario": 0,
            "custo_total": 0,
        }
        linhas.append(linha)
        preco_unitario += payload.valor_adicional

    preco_unitario = round(preco_unitario, 2)
    custo_unitario = round(custo_unitario, 2)
    valor_total = round(preco_unitario * payload.quantidade, 2)
    custo_total = round(custo_unitario * payload.quantidade, 2)
    margem = round(valor_total - custo_total, 2)
    margem_percentual = round((margem / valor_total * 100) if valor_total and custo_total else 0, 2)

    return {
        "produto_chave": PRODUTO_PORTA_GIRO,
        "produto_origem": "global",
        "produto_id": None,
        "produto_versao_id": None,
        "nome": "Porta de Giro",
        "quantidade": payload.quantidade,
        "valor_unitario": preco_unitario,
        "valor_total": valor_total,
        "custo_unitario": custo_unitario,
        "custo_total": custo_total,
        "margem": margem,
        "margem_percentual": margem_percentual,
        "medidas": medidas,
        "dobradicas_alturas": dobradicas_alturas,
        "linhas": linhas,
        "configuracao_snapshot": configuracao_snapshot_porta_giro(),
        "materiais_snapshot": materiais_snapshot(linhas),
        "dados_porta": {
            "ambiente": payload.ambiente,
            "largura": payload.largura,
            "altura": payload.altura,
            "perfil_id": payload.perfil_id,
            "vidro_id": payload.vidro_id,
            "puxador_id": payload.puxador_id,
            "medida_puxador": payload.medida_puxador,
            "lado_puxador": payload.lado_puxador,
            "altura_puxador": payload.altura_puxador,
            "dobradicas": payload.dobradicas,
            "dobradicas_alturas": dobradicas_alturas,
            "lado_dobradica": payload.lado_dobradica,
            "valor_adicional": payload.valor_adicional,
            "observacao_venda": payload.observacao_venda,
            "observacao_producao": payload.observacao_producao,
            "acessorio": payload.acessorio,
        },
    }


def adicionar_porta_giro(empresa_id: str, payload: PortaGiroAdicionar, current_user: dict, request: Request):
    pedido = pedidos_repo.buscar(empresa_id, payload.orcamento_id)
    if not pedido:
        raise HTTPException(status_code=400, detail="Orcamento nao encontrado")

    calculo = calcular_porta_giro(empresa_id, payload)
    linha = pedidos_repo.inserir_linha(empresa_id, {
        "orcamento_id": payload.orcamento_id,
        "nome": nome_linha_porta(payload, calculo),
        "quantidade": payload.quantidade,
        "valor_unitario": calculo["valor_unitario"],
        "valor_total": calculo["valor_total"],
        "dados": montar_snapshot_orcamento_global(payload, calculo),
    })
    if not linha:
        raise HTTPException(status_code=400, detail="Porta de Giro nao adicionada ao orcamento")

    linhas = pedidos_repo.listar_linhas(empresa_id, payload.orcamento_id, limit=5000, offset=0)
    total = sum(float(item.get("valor_total") or 0) for item in linhas)
    custo = sum(custo_linha(item) for item in linhas)
    margem = total - custo
    dados_orcamento = dict(pedido.get("dados") or {})
    dados_orcamento["custo_total"] = round(custo, 2)
    dados_orcamento["margem_total"] = round(margem, 2)
    dados_orcamento["margem_percentual"] = round((margem / total * 100) if total and custo else 0, 2)
    pedidos_repo.atualizar_total(empresa_id, payload.orcamento_id, total, dados=dados_orcamento)

    audit_event(current_user, "adicionar", "produto_global_porta_giro", linha.get("id"), None, linha, request)
    return linha


def montar_snapshot_orcamento_global(payload: PortaGiroAdicionar, calculo: dict):
    return {
        "snapshot_schema": SNAPSHOT_SCHEMA,
        "produto_origem": "global",
        "produto_id": calculo.get("produto_id"),
        "produto_versao_id": calculo.get("produto_versao_id"),
        "produto_global": PRODUTO_PORTA_GIRO,
        "produto_chave": PRODUTO_PORTA_GIRO,
        "nome_produto_snapshot": calculo.get("nome"),
        "valores": calculo.get("dados_porta") or payload.model_dump(),
        "configuracao_snapshot": calculo.get("configuracao_snapshot") or {},
        "materiais_snapshot": calculo.get("materiais_snapshot") or [],
        "calculo_snapshot": calculo,
        "calculo": calculo,
        "custo_total": calculo["custo_total"],
        "margem": calculo["margem"],
        "margem_percentual": calculo["margem_percentual"],
    }


def configuracao_snapshot_porta_giro():
    return {
        "produto_chave": PRODUTO_PORTA_GIRO,
        "formula": "legacy_porta_giro_v1",
        "escopo": "global",
        "campos": [
            "largura",
            "altura",
            "perfil_id",
            "vidro_id",
            "puxador_id",
            "medida_puxador",
            "dobradicas",
            "dobradicas_alturas",
            "valor_adicional",
        ],
        "componentes": [
            "perfil_por_perimetro",
            "vidro_por_area",
            "insumos_do_perfil",
            "puxador_opcional",
            "regras_por_tags",
            "valor_adicional",
        ],
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
            "origem_linha": linha.get("nome"),
            "quantidade": linha.get("quantidade"),
            "unidade": linha.get("unidade"),
            "valor_unitario": linha.get("valor_unitario"),
            "custo_unitario": linha.get("custo_unitario", 0),
            "valor_total": linha.get("total"),
            "custo_total": linha.get("custo_total", 0),
        })
    return snapshot


def nome_linha_porta(payload: PortaGiroPayload, calculo: dict):
    ambiente = payload.ambiente.strip()
    medidas = calculo.get("medidas") or {}
    medida_txt = f"{int(medidas.get('largura_mm') or payload.largura)}x{int(medidas.get('altura_mm') or payload.altura)}"
    return f"Porta de Giro - {ambiente} - {medida_txt}" if ambiente else f"Porta de Giro - {medida_txt}"


def buscar_material_ativo(empresa_id: str, material_id: str, categoria: str, nome_campo: str):
    material = materiais_repo.buscar_material(empresa_id, material_id)
    if not material or not material.get("ativo"):
        raise HTTPException(status_code=400, detail=f"{nome_campo} invalido ou inativo")
    if material.get("categoria") != categoria:
        raise HTTPException(status_code=400, detail=f"{nome_campo} deve ser da categoria {categoria}")
    return material


def validar_puxador_agregado(perfil: dict, puxador: dict):
    config = perfil.get("configuracao") or {}
    agregados = config.get("agregados") or {}
    ids = agregados.get("puxador") or config.get("puxadores_ids") or []
    if ids and str(puxador.get("id")) not in [str(item) for item in ids]:
        raise HTTPException(status_code=400, detail="Puxador nao esta agregado ao perfil selecionado")


def calcular_medidas(largura_mm: float, altura_mm: float):
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


def normalizar_dobradicas(altura_mm: float, quantidade: int, alturas: list[float] | None = None):
    alturas = alturas or []
    if not alturas:
        return distribuir_dobradicas(altura_mm, quantidade)
    if len(alturas) != quantidade:
        raise HTTPException(status_code=400, detail="A quantidade de alturas precisa ser igual a quantidade de dobradicas")
    alturas_validas = []
    for altura_dobradica in alturas:
        valor = float(altura_dobradica)
        if valor <= 0 or valor >= altura_mm:
            raise HTTPException(status_code=400, detail="Alturas das dobradicas precisam estar dentro da altura da porta")
        alturas_validas.append(round(valor, 2))
    return alturas_validas


def distribuir_dobradicas(altura_mm: float, quantidade: int):
    primeira = 100.0
    ultima = max(100.0, altura_mm - 100.0)
    if quantidade == 1:
        return [primeira]
    passo = (ultima - primeira) / (quantidade - 1)
    return [round(primeira + passo * i, 2) for i in range(quantidade)]


def montar_linha_material(nome: str, material: dict, quantidade: float, unidade: str):
    preco = float(material.get("preco_unitario") or 0)
    custo = float(material.get("custo_unitario") or 0)
    return {
        "nome": nome,
        "material": material.get("nome"),
        "material_id": material.get("id"),
        "quantidade": round(float(quantidade or 0), 4),
        "unidade": unidade,
        "valor_unitario": round(preco, 2),
        "total": round(preco * quantidade, 2),
        "custo_unitario": round(custo, 2),
        "custo_total": round(custo * quantidade, 2),
    }


def insumos_do_perfil(empresa_id: str, perfil: dict):
    ids = (perfil.get("configuracao") or {}).get("insumos_ids") or []
    materiais = []
    for insumo_id in ids:
        material = materiais_repo.buscar_material(empresa_id, str(insumo_id))
        if material and material.get("ativo"):
            materiais.append(material)
    return materiais


def quantidade_por_unidade(material: dict, medidas: dict):
    unidade = material.get("unidade")
    if unidade == "metro_linear":
        return medidas["perimetro"]
    if unidade == "metro_quadrado":
        return medidas["area"]
    return 1


def quantidade_puxador(puxador: dict, medida_puxador_mm: float):
    unidade = puxador.get("unidade")
    if unidade != "unidade" and medida_puxador_mm <= 0:
        raise HTTPException(status_code=400, detail="Informe o tamanho do puxador em mm")
    if unidade == "metro_linear":
        return medida_puxador_mm / 1000
    return 1


def unidade_texto(unidade: str | None):
    if unidade == "metro_linear":
        return "m"
    if unidade == "metro_quadrado":
        return "m²"
    return unidade or "un"


def calcular_regras_tags(empresa_id: str, materiais: list[dict], medidas: dict):
    materiais = [m for m in materiais if m]
    if len(materiais) < 2:
        return []
    material_tags = tags_repo.listar_material_tags(empresa_id)
    tags_por_material: dict[str, set[str]] = {}
    for item in material_tags:
        tags_por_material.setdefault(str(item.get("material_id")), set()).add(str(item.get("tag_id")))

    linhas = []
    for regra in tags_repo.listar_regras(empresa_id, ativos_apenas=True):
        for material_a in materiais:
            if material_a.get("categoria") != regra.get("categoria_a"):
                continue
            for material_b in materiais:
                if material_b.get("id") == material_a.get("id") or material_b.get("categoria") != regra.get("categoria_b"):
                    continue
                if not regra_casa(regra, material_a, material_b, tags_por_material):
                    continue
                quantidade = quantidade_regra(regra, medidas)
                valor = float(regra.get("valor_unitario") or 0)
                linhas.append({
                    "nome": regra.get("cobranca_nome") or regra.get("nome"),
                    "material": f"{material_a.get('nome')} + {material_b.get('nome')}",
                    "quantidade": round(quantidade, 4),
                    "unidade": unidade_texto(regra.get("unidade_calculo")),
                    "valor_unitario": round(valor, 2),
                    "total": round(valor * quantidade, 2),
                    "custo_unitario": 0,
                    "custo_total": 0,
                    "regra_id": regra.get("id"),
                })
    return linhas


def regra_casa(regra: dict, material_a: dict, material_b: dict, tags_por_material: dict[str, set[str]]):
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


def quantidade_regra(regra: dict, medidas: dict):
    unidade = regra.get("unidade_calculo")
    if unidade == "metro_linear":
        return medidas["perimetro"]
    if unidade == "metro_quadrado":
        return medidas["area"]
    return 1


def custo_linha(linha: dict):
    dados = linha.get("dados") or {}
    if isinstance(dados, dict):
        if dados.get("custo_total") is not None:
            return float(dados.get("custo_total") or 0)
        calculo = dados.get("calculo") or dados.get("calculo_snapshot") or {}
        if isinstance(calculo, dict) and calculo.get("custo_total") is not None:
            return float(calculo.get("custo_total") or 0)
    return 0.0
