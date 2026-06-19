from fastapi import HTTPException, Request

from app.core.auth import audit_event
from app.repositories import clientes_repo
from app.repositories.common import buscar_loja_principal
from app.schemas.clientes import ClienteCreate, ClienteUpdate


def listar(empresa_id: str):
    return clientes_repo.listar_clientes(empresa_id)


def criar(empresa_id: str, payload: ClienteCreate, current_user: dict, request: Request):
    nome = payload.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do cliente")

    existente = clientes_repo.buscar_por_nome(empresa_id, nome)
    if existente:
        return existente

    loja = buscar_loja_principal(empresa_id)
    dados = {
        "empresa_id": empresa_id,
        "nome": nome,
        "documento": payload.documento.strip(),
        "email": payload.email.strip().lower(),
        "telefone": payload.telefone.strip(),
    }
    if loja:
        dados["loja_id"] = loja["id"]

    cliente = clientes_repo.criar_cliente(dados)
    if not cliente:
        raise HTTPException(status_code=400, detail="Cliente nao criado")
    audit_event(current_user, "criar", "cliente", cliente.get("id"), None, cliente, request)
    return cliente


def editar(empresa_id: str, payload: ClienteUpdate, current_user: dict, request: Request):
    if not payload.id.strip():
        raise HTTPException(status_code=400, detail="Cliente nao identificado")
    nome = payload.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do cliente")

    anterior = clientes_repo.buscar_cliente(empresa_id, payload.id)
    if not anterior:
        raise HTTPException(status_code=400, detail="Cliente nao encontrado")

    dados = {
        "nome": nome,
        "documento": payload.documento.strip(),
        "email": payload.email.strip().lower(),
        "telefone": payload.telefone.strip(),
    }
    cliente = clientes_repo.editar_cliente(empresa_id, payload.id, dados)
    if not cliente:
        raise HTTPException(status_code=400, detail="Cliente nao atualizado")
    audit_event(current_user, "editar", "cliente", payload.id, anterior, cliente, request)
    return cliente
