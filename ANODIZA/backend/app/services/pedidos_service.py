import logging

from fastapi import HTTPException, Request

from app.core.auth import audit_event
from app.repositories import clientes_repo, pedidos_repo
from app.repositories.common import garantir_loja_operacional
from app.schemas.pedidos import PedidoCreate, PedidoProdutoCreate, PedidoUpdate

logger = logging.getLogger(__name__)


def listar(empresa_id: str, busca: str = "", limit: int = 500, offset: int = 0):
    termo = busca.strip().lower()
    lista = []
    for item in pedidos_repo.listar(empresa_id, limit=limit, offset=offset):
        cliente_nome = str(item.get("cliente_nome") or "")
        numero = str(item.get("numero_pedido") or "")
        nome = str(item.get("nome_orcamento") or "")
        if termo and termo not in f"{cliente_nome} {numero} {nome}".lower():
            continue
        lista.append({"id": item.get("id"), "cliente_id": item.get("cliente_id"), "cliente_nome": cliente_nome, "numero_pedido": numero, "nome_orcamento": nome or f"Orcamento {numero}", "status": item.get("status") or "rascunho", "valor_total": float(item.get("valor_total") or 0), "created_at": item.get("created_at")})
    return lista


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
    dados = {"loja_id": loja_id, "cliente_id": cliente_id, "numero_pedido": str(proximo_numero(empresa_id)), "nome_orcamento": nome, "cliente_nome": cliente["nome"], "cliente_telefone": str(cliente.get("telefone") or ""), "status": "rascunho", "valor_total": 0, "dados": {}}
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
    dados = {"loja_id": loja_id, "cliente_id": payload.cliente_id, "cliente_nome": cliente["nome"], "cliente_telefone": str(cliente.get("telefone") or ""), "numero_pedido": numero, "nome_orcamento": payload.nome_orcamento.strip()}
    atualizado = pedidos_repo.atualizar(empresa_id, payload.id, dados)
    if not atualizado:
        raise HTTPException(status_code=400, detail="Orcamento nao atualizado")
    audit_event(current_user, "editar", "orcamento", payload.id, pedido, atualizado, request)
    return atualizado


def aprovar(empresa_id: str, item_id: str, current_user: dict, request: Request):
    pedido = pedidos_repo.buscar(empresa_id, item_id)
    if not pedido:
        raise HTTPException(status_code=400, detail="Orcamento nao encontrado")
    atualizado = pedidos_repo.atualizar(empresa_id, item_id, {"status": "aprovado"})
    if not atualizado:
        raise HTTPException(status_code=400, detail="Orcamento nao aprovado")
    audit_event(current_user, "aprovar", "orcamento", item_id, pedido, atualizado, request)
    return atualizado


def listar_linhas(empresa_id: str, item_id: str, limit: int = 500, offset: int = 0):
    if not pedidos_repo.buscar(empresa_id, item_id):
        return []
    return pedidos_repo.listar_linhas(empresa_id, item_id, limit=limit, offset=offset)


def recalcular_total(empresa_id: str, item_id: str):
    if not pedidos_repo.buscar(empresa_id, item_id):
        raise HTTPException(status_code=400, detail="Orcamento nao encontrado")
    total = sum(float(item.get("valor_total") or 0) for item in pedidos_repo.listar_linhas(empresa_id, item_id, limit=5000, offset=0))
    pedidos_repo.atualizar_total(empresa_id, item_id, total)
    return total


def criar_linha(empresa_id: str, payload: PedidoProdutoCreate, current_user: dict, request: Request):
    if not payload.nome.strip():
        raise HTTPException(status_code=400, detail="Informe o nome do produto")
    if payload.quantidade <= 0:
        raise HTTPException(status_code=400, detail="Quantidade deve ser maior que zero")
    if not pedidos_repo.buscar(empresa_id, payload.orcamento_id):
        raise HTTPException(status_code=400, detail="Orcamento nao encontrado")
    dados = {"orcamento_id": payload.orcamento_id, "nome": payload.nome.strip(), "quantidade": payload.quantidade, "valor_unitario": payload.valor_unitario, "valor_total": payload.quantidade * payload.valor_unitario}
    linha = pedidos_repo.inserir_linha(empresa_id, dados)
    if not linha:
        raise HTTPException(status_code=400, detail="Produto nao cadastrado")
    recalcular_total(empresa_id, payload.orcamento_id)
    audit_event(current_user, "criar", "orcamento_produto", linha.get("id"), None, linha, request)
    return linha
