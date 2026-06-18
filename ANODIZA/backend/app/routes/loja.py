from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.auth import assert_same_company, audit_event, normalize_permissions, require_master, require_permission
from app.db.supabase_client import get_supabase

router = APIRouter()


def buscar_loja_principal(supabase, empresa_id: str):
    result = supabase.table("lojas").select("id,nome").eq("empresa_id", empresa_id).order("created_at", desc=False).limit(1).execute()
    return result.data[0] if result.data else None


def buscar_cliente(supabase, empresa_id: str, cliente_id: str):
    if not cliente_id:
        return None
    result = supabase.table("clientes").select("id,nome,documento,email,telefone,ativo").eq("empresa_id", empresa_id).eq("id", cliente_id).limit(1).execute()
    return result.data[0] if result.data else None


def buscar_usuario(supabase, empresa_id: str, usuario_id: str):
    if not usuario_id:
        return None
    result = supabase.table("usuarios").select("id,nome,email,perfil,ativo,loja_id,permissoes").eq("empresa_id", empresa_id).eq("id", usuario_id).limit(1).execute()
    return result.data[0] if result.data else None


def buscar_orcamento(supabase, empresa_id: str, orcamento_id: str):
    if not orcamento_id:
        return None
    result = supabase.table("orcamentos").select("id,empresa_id,cliente_id,numero_pedido,nome_orcamento,cliente_nome,status,valor_total").eq("empresa_id", empresa_id).eq("id", orcamento_id).limit(1).execute()
    return result.data[0] if result.data else None


def proximo_numero_orcamento(supabase, cliente_id: str) -> int:
    result = supabase.table("orcamentos").select("numero_pedido").eq("cliente_id", cliente_id).limit(2000).execute()
    maior = 0
    for item in result.data or []:
        numero = str(item.get("numero_pedido") or "").strip()
        if numero.isdigit():
            maior = max(maior, int(numero))
    return maior + 1


def recalcular_valor_orcamento(supabase, orcamento_id: str):
    produtos = supabase.table("orcamento_produtos").select("valor_total").eq("orcamento_id", orcamento_id).execute()
    total = sum(float(item.get("valor_total") or 0) for item in (produtos.data or []))
    supabase.table("orcamentos").update({"valor_total": total}).eq("id", orcamento_id).execute()
    return total


@router.get("/index")
def index_loja(current_user: dict = Depends(require_permission("painel"))):
    return {
        "titulo": "Painel da Loja",
        "cards": [
            {"label": "Orcamentos", "valor": 0},
            {"label": "Aprovados", "valor": 0},
            {"label": "Em producao", "valor": 0},
        ],
    }


@router.get("/clientes")
def listar_clientes(empresa_slug: str = Query(default=""), current_user: dict = Depends(require_permission("clientes"))):
    supabase = get_supabase()
    empresa_id = assert_same_company(current_user, empresa_slug=empresa_slug)
    result = supabase.table("clientes").select("id,nome,documento,email,telefone,ativo").eq("empresa_id", empresa_id).order("created_at", desc=False).execute()
    return result.data or []


@router.post("/clientes")
def criar_cliente(payload: dict, request: Request, current_user: dict = Depends(require_permission("clientes"))):
    supabase = get_supabase()
    empresa_id = assert_same_company(current_user, empresa_slug=str(payload.get("empresa_slug") or "").strip())
    nome = str(payload.get("nome") or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do cliente")

    existente = supabase.table("clientes").select("id,nome,documento,email,telefone,ativo").eq("empresa_id", empresa_id).ilike("nome", nome).limit(1).execute()
    if existente.data:
        return existente.data[0]

    loja = buscar_loja_principal(supabase, empresa_id)
    dados = {
        "empresa_id": empresa_id,
        "nome": nome,
        "documento": str(payload.get("documento") or "").strip(),
        "email": str(payload.get("email") or "").strip().lower(),
        "telefone": str(payload.get("telefone") or "").strip(),
    }
    if loja:
        dados["loja_id"] = loja["id"]

    try:
        result = supabase.table("clientes").insert(dados).execute()
    except Exception as error:
        raise HTTPException(status_code=400, detail="Cliente nao criado") from error
    if not result.data:
        raise HTTPException(status_code=400, detail="Cliente nao criado")
    audit_event(current_user, "criar", "cliente", result.data[0].get("id"), None, result.data[0], request)
    return result.data[0]


@router.post("/clientes/editar")
def editar_cliente(payload: dict, request: Request, current_user: dict = Depends(require_permission("clientes"))):
    supabase = get_supabase()
    empresa_id = assert_same_company(current_user, empresa_slug=str(payload.get("empresa_slug") or "").strip())
    cliente_id = str(payload.get("id") or "").strip()
    nome = str(payload.get("nome") or "").strip()
    if not cliente_id:
        raise HTTPException(status_code=400, detail="Cliente nao identificado")
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do cliente")

    cliente = buscar_cliente(supabase, empresa_id, cliente_id)
    if not cliente:
        raise HTTPException(status_code=400, detail="Cliente nao encontrado")
    dados = {
        "nome": nome,
        "documento": str(payload.get("documento") or "").strip(),
        "email": str(payload.get("email") or "").strip().lower(),
        "telefone": str(payload.get("telefone") or "").strip(),
    }
    result = supabase.table("clientes").update(dados).eq("empresa_id", empresa_id).eq("id", cliente_id).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Cliente nao atualizado")
    audit_event(current_user, "editar", "cliente", cliente_id, cliente, result.data[0], request)
    return result.data[0]


@router.get("/usuarios")
def listar_usuarios(empresa_slug: str = Query(default=""), current_user: dict = Depends(require_master)):
    supabase = get_supabase()
    empresa_id = assert_same_company(current_user, empresa_slug=empresa_slug)
    result = supabase.table("usuarios").select("id,nome,email,perfil,ativo,loja_id,permissoes").eq("empresa_id", empresa_id).order("created_at", desc=False).execute()
    lista = []
    for usuario in result.data or []:
        usuario["permissoes"] = normalize_permissions(usuario.get("permissoes"), usuario.get("perfil") or "vendedor")
        lista.append(usuario)
    return lista


@router.post("/usuarios")
def criar_usuario(payload: dict, request: Request, current_user: dict = Depends(require_master)):
    empresa_slug = str(payload.get("empresa_slug") or "").strip()
    assert_same_company(current_user, empresa_slug=empresa_slug)
    try:
        result = get_supabase().rpc("criar_usuario_empresa", {"payload": payload}).execute()
    except Exception as error:
        raise HTTPException(status_code=400, detail="Usuario nao criado") from error
    if not result.data:
        raise HTTPException(status_code=400, detail="Usuario nao criado")
    audit_event(current_user, "criar", "usuario", None, None, result.data, request)
    return result.data


@router.post("/usuarios/permissoes")
def editar_permissoes_usuario(payload: dict, request: Request, current_user: dict = Depends(require_master)):
    supabase = get_supabase()
    empresa_id = assert_same_company(current_user, empresa_slug=str(payload.get("empresa_slug") or "").strip())
    usuario_id = str(payload.get("id") or "").strip()
    permissoes_payload = payload.get("permissoes") or {}
    usuario = buscar_usuario(supabase, empresa_id, usuario_id)
    if not usuario:
        raise HTTPException(status_code=400, detail="Usuario nao encontrado")
    if usuario.get("perfil") == "owner":
        raise HTTPException(status_code=400, detail="O usuario master sempre tem acesso total")
    permissoes = normalize_permissions(permissoes_payload, usuario.get("perfil") or "vendedor")
    permissoes["usuarios"] = False
    result = supabase.table("usuarios").update({"permissoes": permissoes}).eq("empresa_id", empresa_id).eq("id", usuario_id).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Permissoes nao atualizadas")
    audit_event(current_user, "alterar_permissoes", "usuario", usuario_id, {"permissoes": usuario.get("permissoes")}, {"permissoes": permissoes}, request)
    return result.data[0]


@router.get("/orcamentos")
def listar_orcamentos(empresa_slug: str = Query(default=""), busca: str = Query(default=""), current_user: dict = Depends(require_permission("orcamentos"))):
    supabase = get_supabase()
    empresa_id = assert_same_company(current_user, empresa_slug=empresa_slug)
    clientes_result = supabase.table("clientes").select("id,nome").eq("empresa_id", empresa_id).execute()
    cliente_por_id = {cliente["id"]: cliente.get("nome", "") for cliente in (clientes_result.data or [])}
    result = supabase.table("orcamentos").select("id,cliente_id,numero_pedido,nome_orcamento,cliente_nome,status,valor_total,created_at").eq("empresa_id", empresa_id).order("created_at", desc=True).limit(500).execute()
    termo = busca.strip().lower()
    lista = []
    for item in result.data or []:
        cliente_nome = cliente_por_id.get(item.get("cliente_id"), str(item.get("cliente_nome") or ""))
        numero = str(item.get("numero_pedido") or "")
        nome_orcamento = str(item.get("nome_orcamento") or "")
        if termo and termo not in f"{cliente_nome} {numero} {nome_orcamento}".lower():
            continue
        lista.append({"id": item.get("id"), "cliente_id": item.get("cliente_id"), "cliente_nome": cliente_nome, "numero_pedido": numero, "nome_orcamento": nome_orcamento or f"Orcamento {numero}", "status": item.get("status") or "rascunho", "valor_total": float(item.get("valor_total") or 0), "created_at": item.get("created_at")})
    return lista


@router.post("/orcamentos")
def criar_orcamento(payload: dict, request: Request, current_user: dict = Depends(require_permission("orcamentos"))):
    supabase = get_supabase()
    empresa_id = assert_same_company(current_user, empresa_slug=str(payload.get("empresa_slug") or "").strip())
    cliente_id = str(payload.get("cliente_id") or "").strip()
    nome_orcamento = str(payload.get("nome_orcamento") or "").strip()
    if not nome_orcamento:
        raise HTTPException(status_code=400, detail="Informe o nome do orcamento")
    if not cliente_id:
        raise HTTPException(status_code=400, detail="Selecione o cliente")
    cliente = buscar_cliente(supabase, empresa_id, cliente_id)
    if not cliente:
        raise HTTPException(status_code=400, detail="Cliente nao encontrado")
    loja = buscar_loja_principal(supabase, empresa_id)
    dados = {"empresa_id": empresa_id, "cliente_id": cliente_id, "numero_pedido": str(proximo_numero_orcamento(supabase, cliente_id)), "nome_orcamento": nome_orcamento, "cliente_nome": cliente["nome"], "cliente_telefone": str(cliente.get("telefone") or ""), "status": "rascunho", "valor_total": 0, "dados": {}}
    if loja:
        dados["loja_id"] = loja["id"]
    result = supabase.table("orcamentos").insert(dados).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Orcamento nao criado")
    audit_event(current_user, "criar", "orcamento", result.data[0].get("id"), None, result.data[0], request)
    return result.data[0]


@router.post("/orcamentos/editar")
def editar_orcamento(payload: dict, request: Request, current_user: dict = Depends(require_permission("orcamentos"))):
    supabase = get_supabase()
    empresa_id = assert_same_company(current_user, empresa_slug=str(payload.get("empresa_slug") or "").strip())
    orcamento_id = str(payload.get("id") or "").strip()
    cliente_id = str(payload.get("cliente_id") or "").strip()
    nome_orcamento = str(payload.get("nome_orcamento") or "").strip()
    orcamento = buscar_orcamento(supabase, empresa_id, orcamento_id)
    if not orcamento:
        raise HTTPException(status_code=400, detail="Orcamento nao encontrado")
    cliente = buscar_cliente(supabase, empresa_id, cliente_id)
    if not cliente:
        raise HTTPException(status_code=400, detail="Cliente nao encontrado")
    numero_pedido = str(orcamento.get("numero_pedido") or "")
    if str(orcamento.get("cliente_id") or "") != cliente_id:
        numero_pedido = str(proximo_numero_orcamento(supabase, cliente_id))
    dados = {"cliente_id": cliente_id, "cliente_nome": cliente["nome"], "cliente_telefone": str(cliente.get("telefone") or ""), "numero_pedido": numero_pedido, "nome_orcamento": nome_orcamento}
    result = supabase.table("orcamentos").update(dados).eq("empresa_id", empresa_id).eq("id", orcamento_id).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Orcamento nao atualizado")
    audit_event(current_user, "editar", "orcamento", orcamento_id, orcamento, result.data[0], request)
    return result.data[0]


@router.post("/orcamentos/aprovar")
def aprovar_orcamento(payload: dict, request: Request, current_user: dict = Depends(require_permission("orcamentos"))):
    supabase = get_supabase()
    empresa_id = assert_same_company(current_user, empresa_slug=str(payload.get("empresa_slug") or "").strip())
    orcamento_id = str(payload.get("id") or "").strip()
    orcamento = buscar_orcamento(supabase, empresa_id, orcamento_id)
    if not orcamento:
        raise HTTPException(status_code=400, detail="Orcamento nao encontrado")
    result = supabase.table("orcamentos").update({"status": "aprovado"}).eq("empresa_id", empresa_id).eq("id", orcamento_id).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Orcamento nao aprovado")
    audit_event(current_user, "aprovar", "orcamento", orcamento_id, orcamento, result.data[0], request)
    return result.data[0]


@router.get("/orcamentos/produtos")
def listar_produtos_orcamento(empresa_slug: str = Query(default=""), orcamento_id: str = Query(default=""), current_user: dict = Depends(require_permission("orcamentos"))):
    supabase = get_supabase()
    empresa_id = assert_same_company(current_user, empresa_slug=empresa_slug)
    if not buscar_orcamento(supabase, empresa_id, orcamento_id):
        return []
    result = supabase.table("orcamento_produtos").select("id,nome,quantidade,valor_unitario,valor_total,created_at").eq("empresa_id", empresa_id).eq("orcamento_id", orcamento_id).order("created_at", desc=False).execute()
    return result.data or []


@router.post("/orcamentos/produtos")
def cadastrar_produto_orcamento(payload: dict, request: Request, current_user: dict = Depends(require_permission("orcamentos"))):
    supabase = get_supabase()
    empresa_id = assert_same_company(current_user, empresa_slug=str(payload.get("empresa_slug") or "").strip())
    orcamento_id = str(payload.get("orcamento_id") or "").strip()
    nome = str(payload.get("nome") or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do produto")
    try:
        quantidade = float(payload.get("quantidade") or 1)
        valor_unitario = float(payload.get("valor_unitario") or 0)
    except (TypeError, ValueError) as error:
        raise HTTPException(status_code=400, detail="Quantidade ou valor invalido") from error
    if quantidade <= 0:
        raise HTTPException(status_code=400, detail="Quantidade deve ser maior que zero")
    if not buscar_orcamento(supabase, empresa_id, orcamento_id):
        raise HTTPException(status_code=400, detail="Orcamento nao encontrado")
    dados = {"empresa_id": empresa_id, "orcamento_id": orcamento_id, "nome": nome, "quantidade": quantidade, "valor_unitario": valor_unitario, "valor_total": quantidade * valor_unitario}
    result = supabase.table("orcamento_produtos").insert(dados).execute()
    recalcular_valor_orcamento(supabase, orcamento_id)
    if not result.data:
        raise HTTPException(status_code=400, detail="Produto nao cadastrado")
    audit_event(current_user, "criar", "orcamento_produto", result.data[0].get("id"), None, result.data[0], request)
    return result.data[0]
