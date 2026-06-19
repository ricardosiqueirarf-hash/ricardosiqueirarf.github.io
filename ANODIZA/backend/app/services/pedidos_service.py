from fastapi import HTTPException, Request

from app.core.auth import audit_event
from app.repositories import clientes_repo, pedidos_repo
from app.repositories.common import buscar_loja_principal
from app.schemas.pedidos import PedidoCreate, PedidoProdutoCreate, PedidoUpdate


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


def proximo_numero(empresa_id: str, cliente_id: str) -> int:
    maior = 0
    for item in pedidos_repo.listar_numeros_por_cliente(empresa_id, cliente_id):
        numero = str(item.get("numero_pedido") or "").strip()
        if numero.isdigit():
            maior = max(maior, int(numero))
    return maior + 1


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
    loja = buscar_loja_principal(empresa_id)
    dados = {"cliente_id": cliente_id, "numero_pedido": str(proximo_numero(empresa_id, cliente_id)), "nome_orcamento": nome, "cliente_nome": cliente["nome"], "cliente_telefone": str(cliente.get("telefone") or ""), "status": "rascunho", "valor_total": 0, "dados": {}}
    if loja:
        dados["loja_id"] = loja["id"]
    pedido = pedidos_repo.inserir(empresa_id, dados)
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
    if str(pedido.get("cliente_id") or "") != payload.cliente_id:
        numero = str(proximo_numero(empresa_id, payload.cliente_id))
    dados = {"cliente_id": payload.cliente_id, "cliente_nome": cliente["nome"], "cliente_telefone": str(cliente.get("telefone") or ""), "numero_pedido": numero, "nome_orcamento": payload.nome_orcamento.strip()}
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
