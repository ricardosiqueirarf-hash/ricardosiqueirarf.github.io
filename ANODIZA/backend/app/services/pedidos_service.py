import logging
from datetime import datetime, timezone

from fastapi import HTTPException, Request

from app.core.auth import audit_event
from app.repositories import clientes_repo, pedidos_repo
from app.repositories.common import garantir_loja_operacional
from app.schemas.pedidos import PedidoCreate, PedidoProdutoCreate, PedidoUpdate

logger = logging.getLogger(__name__)


def listar(empresa_id: str, busca: str = "", limit: int = 500, offset: int = 0):
    termo = busca.strip().lower()
    pedidos = pedidos_repo.listar(empresa_id, limit=limit, offset=offset)
    usuarios = {str(item.get("id")): item for item in pedidos_repo.listar_usuarios_resumo(empresa_id)}
    linhas_por_orcamento = agrupar_linhas(pedidos_repo.listar_linhas_por_orcamentos(empresa_id, [str(item.get("id")) for item in pedidos]))
    lista = []

    for item in pedidos:
        cliente_nome = str(item.get("cliente_nome") or "")
        numero = str(item.get("numero_pedido") or "")
        nome = str(item.get("nome_orcamento") or "")
        usuario = usuarios.get(str(item.get("usuario_id") or "")) or {}
        dados = item.get("dados") or {}
        resumo = resumo_financeiro(item, linhas_por_orcamento.get(str(item.get("id")), []))

        if termo and termo not in f"{cliente_nome} {numero} {nome} {usuario.get('nome') or ''}".lower():
            continue

        lista.append({
            "id": item.get("id"),
            "cliente_id": item.get("cliente_id"),
            "cliente_nome": cliente_nome,
            "numero_pedido": numero,
            "nome_orcamento": nome or f"Orcamento {numero}",
            "status": item.get("status") or "rascunho",
            "valor_total": float(item.get("valor_total") or 0),
            "preco": resumo["preco"],
            "custo": resumo["custo"],
            "margem": resumo["margem"],
            "margem_percentual": resumo["margem_percentual"],
            "created_at": item.get("created_at"),
            "updated_at": item.get("updated_at"),
            "aprovado_em": dados.get("aprovado_em") or "",
            "usuario_id": item.get("usuario_id"),
            "usuario_nome": usuario.get("nome") or usuario.get("email") or "-",
            "aprovado_por": dados.get("aprovado_por_nome") or dados.get("aprovado_por") or "",
        })
    return lista


def agrupar_linhas(linhas: list[dict]):
    agrupadas: dict[str, list[dict]] = {}
    for linha in linhas:
        agrupadas.setdefault(str(linha.get("orcamento_id")), []).append(linha)
    return agrupadas


def resumo_financeiro(orcamento: dict, linhas: list[dict]):
    dados = orcamento.get("dados") or {}
    preco = float(orcamento.get("valor_total") or 0)
    custo = float(dados.get("custo_total") or dados.get("custo") or 0)

    if not custo:
        custo = sum(custo_linha(linha) for linha in linhas)

    margem = preco - custo if custo else 0
    margem_percentual = (margem / preco * 100) if preco and custo else 0
    return {
        "preco": round(preco, 2),
        "custo": round(custo, 2),
        "margem": round(margem, 2),
        "margem_percentual": round(margem_percentual, 2),
    }


def custo_linha(linha: dict):
    dados = linha.get("dados") or {}
    if isinstance(dados, dict):
        if dados.get("custo_total") is not None:
            return float(dados.get("custo_total") or 0)
        calculo = dados.get("calculo") or {}
        if isinstance(calculo, dict) and calculo.get("custo_total") is not None:
            return float(calculo.get("custo_total") or 0)
    return 0.0


def proximo_numero(empresa_id: str, cliente_id: str | None = None) -> int:
    maior = 0
    for item in pedidos_repo.listar_numeros_por_empresa(empresa_id):
        numero = str(item.get("numero_pedido") or "").strip()
        if numero.isdigit():
            maior = max(maior, int(numero))
    return maior + 1


def loja_id_do_cliente_ou_operacao(empresa_id: str, cliente: dict):
    loja_id = str(cliente.get("loja_id") or "").strip()
    if loja_id:
        return loja_id
    loja = garantir_loja_operacional(empresa_id)
    if not loja:
        raise HTTPException(status_code=400, detail="Nao foi possivel preparar a operacao interna para criar orcamentos")
    return str(loja["id"])


def criar(empresa_id: str, payload: PedidoCreate, current_user: dict, request: Request):
    nome = payload.nome_orcamento.strip()
    cliente_id = payload.cliente_id.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do orcamento")
    if not cliente_id:
        raise HTTPException(status_code=400, detail="Selecione o cliente")
    cliente = clientes_repo.buscar_cliente(empresa_id, cliente_id)
    if not cliente:
        raise HTTPException(status_code=400, detail="Cliente nao encontrado")
    loja_id = loja_id_do_cliente_ou_operacao(empresa_id, cliente)
    dados = {
        "loja_id": loja_id,
        "usuario_id": current_user.get("id"),
        "cliente_id": cliente_id,
        "numero_pedido": str(proximo_numero(empresa_id)),
        "nome_orcamento": nome,
        "cliente_nome": cliente["nome"],
        "cliente_documento": str(cliente.get("documento") or ""),
        "cliente_telefone": str(cliente.get("telefone") or ""),
        "status": "rascunho",
        "valor_total": 0,
        "dados": {},
    }
    try:
        pedido = pedidos_repo.inserir(empresa_id, dados)
    except Exception as error:
        logger.exception("Falha ao criar orcamento: empresa_id=%s loja_id=%s cliente_id=%s numero=%s", empresa_id, loja_id, cliente_id, dados.get("numero_pedido"))
        raise HTTPException(status_code=400, detail=f"Orcamento nao criado: {str(error)}") from error
    if not pedido:
        raise HTTPException(status_code=400, detail="Orcamento nao criado")
    audit_event(current_user, "criar", "orcamento", pedido.get("id"), None, pedido, request)
    return pedido


def editar(empresa_id: str, payload: PedidoUpdate, current_user: dict, request: Request):
    pedido = pedidos_repo.buscar(empresa_id, payload.id)
    if not pedido:
        raise HTTPException(status_code=400, detail="Orcamento nao encontrado")
    cliente = clientes_repo.buscar_cliente(empresa_id, payload.cliente_id)
    if not cliente:
        raise HTTPException(status_code=400, detail="Cliente nao encontrado")
    numero = str(pedido.get("numero_pedido") or "")
    loja_id = loja_id_do_cliente_ou_operacao(empresa_id, cliente)
    dados = {"loja_id": loja_id, "cliente_id": payload.cliente_id, "cliente_nome": cliente["nome"], "cliente_documento": str(cliente.get("documento") or ""), "cliente_telefone": str(cliente.get("telefone") or ""), "numero_pedido": numero, "nome_orcamento": payload.nome_orcamento.strip()}
    atualizado = pedidos_repo.atualizar(empresa_id, payload.id, dados)
    if not atualizado:
        raise HTTPException(status_code=400, detail="Orcamento nao atualizado")
    audit_event(current_user, "editar", "orcamento", payload.id, pedido, atualizado, request)
    return atualizado


def aprovar(empresa_id: str, item_id: str, current_user: dict, request: Request):
    pedido = pedidos_repo.buscar(empresa_id, item_id)
    if not pedido:
        raise HTTPException(status_code=400, detail="Orcamento nao encontrado")
    dados = dict(pedido.get("dados") or {})
    dados["aprovado_em"] = datetime.now(timezone.utc).isoformat()
    dados["aprovado_por"] = current_user.get("id")
    dados["aprovado_por_nome"] = current_user.get("nome") or current_user.get("email") or ""
    atualizado = pedidos_repo.atualizar(empresa_id, item_id, {"status": "aprovado", "dados": dados})
    if not atualizado:
        raise HTTPException(status_code=400, detail="Orcamento nao aprovado")
    audit_event(current_user, "aprovar", "orcamento", item_id, pedido, atualizado, request)
    return atualizado


def listar_linhas(empresa_id: str, item_id: str, limit: int = 500, offset: int = 0):
    if not pedidos_repo.buscar(empresa_id, item_id):
        return []
    return pedidos_repo.listar_linhas(empresa_id, item_id, limit=limit, offset=offset)


def recalcular_total(empresa_id: str, item_id: str):
    pedido = pedidos_repo.buscar(empresa_id, item_id)
    if not pedido:
        raise HTTPException(status_code=400, detail="Orcamento nao encontrado")
    linhas = pedidos_repo.listar_linhas(empresa_id, item_id, limit=5000, offset=0)
    total = sum(float(item.get("valor_total") or 0) for item in linhas)
    dados = dict(pedido.get("dados") or {})
    resumo = resumo_financeiro({**pedido, "valor_total": total, "dados": dados}, linhas)
    dados["custo_total"] = resumo["custo"]
    dados["margem_total"] = resumo["margem"]
    dados["margem_percentual"] = resumo["margem_percentual"]
    pedidos_repo.atualizar_total(empresa_id, item_id, total, dados=dados)
    return total


def criar_linha(empresa_id: str, payload: PedidoProdutoCreate, current_user: dict, request: Request):
    if not payload.nome.strip():
        raise HTTPException(status_code=400, detail="Informe o nome do produto")
    if payload.quantidade <= 0:
        raise HTTPException(status_code=400, detail="Quantidade deve ser maior que zero")
    if not pedidos_repo.buscar(empresa_id, payload.orcamento_id):
        raise HTTPException(status_code=400, detail="Orcamento nao encontrado")
    dados = {"orcamento_id": payload.orcamento_id, "nome": payload.nome.strip(), "quantidade": payload.quantidade, "valor_unitario": payload.valor_unitario, "valor_total": payload.quantidade * payload.valor_unitario, "dados": {}}
    linha = pedidos_repo.inserir_linha(empresa_id, dados)
    if not linha:
        raise HTTPException(status_code=400, detail="Produto nao cadastrado")
    recalcular_total(empresa_id, payload.orcamento_id)
    audit_event(current_user, "criar", "orcamento_produto", linha.get("id"), None, linha, request)
    return linha
