from fastapi import APIRouter, HTTPException, Query

from app.db.supabase_client import get_supabase

router = APIRouter()


@router.get("/index")
def index_loja():
    return {
        "titulo": "Painel da Loja",
        "cards": [
            {"label": "Orcamentos", "valor": 0},
            {"label": "Aprovados", "valor": 0},
            {"label": "Em producao", "valor": 0},
        ],
    }


def buscar_empresa_id(supabase, empresa_slug: str):
    if not empresa_slug:
        return None
    empresa_result = supabase.table("empresas").select("id").eq("slug", empresa_slug).limit(1).execute()
    if not empresa_result.data:
        return None
    return empresa_result.data[0]["id"]


def buscar_loja_principal(supabase, empresa_id: str):
    result = supabase.table("lojas").select("id,nome").eq("empresa_id", empresa_id).order("created_at", desc=False).limit(1).execute()
    if not result.data:
        return None
    return result.data[0]


def buscar_ou_criar_cliente(supabase, empresa_id: str, cliente_nome: str):
    existente = (
        supabase.table("clientes")
        .select("id,nome")
        .eq("empresa_id", empresa_id)
        .ilike("nome", cliente_nome)
        .limit(1)
        .execute()
    )
    if existente.data:
        return existente.data[0]

    loja = buscar_loja_principal(supabase, empresa_id)
    dados = {"empresa_id": empresa_id, "nome": cliente_nome}
    if loja:
        dados["loja_id"] = loja["id"]

    criado = supabase.table("clientes").insert(dados).execute()
    if not criado.data:
        return None
    return criado.data[0]


def proximo_numero_orcamento(supabase, cliente_id: str) -> int:
    result = supabase.table("orcamentos").select("numero_pedido").eq("cliente_id", cliente_id).limit(2000).execute()
    maior = 0
    for item in result.data or []:
        numero = str(item.get("numero_pedido") or "").strip()
        if numero.isdigit():
            maior = max(maior, int(numero))
    return maior + 1


@router.get("/clientes")
def listar_clientes(empresa_slug: str = Query(default="")):
    supabase = get_supabase()
    empresa_id = buscar_empresa_id(supabase, empresa_slug)
    if not empresa_id:
        return []

    result = supabase.table("clientes").select("id,nome,telefone,ativo").eq("empresa_id", empresa_id).order("created_at", desc=False).execute()
    return result.data or []


@router.get("/usuarios")
def listar_usuarios(empresa_slug: str = Query(default="")):
    supabase = get_supabase()
    empresa_id = buscar_empresa_id(supabase, empresa_slug)
    if not empresa_id:
        return []

    result = supabase.table("usuarios").select("id,nome,email,perfil,ativo,loja_id").eq("empresa_id", empresa_id).order("created_at", desc=False).execute()
    return result.data or []


@router.get("/orcamentos")
def listar_orcamentos(empresa_slug: str = Query(default=""), busca: str = Query(default="")):
    supabase = get_supabase()
    empresa_id = buscar_empresa_id(supabase, empresa_slug)
    if not empresa_id:
        return []

    clientes_result = supabase.table("clientes").select("id,nome").eq("empresa_id", empresa_id).execute()
    cliente_por_id = {cliente["id"]: cliente.get("nome", "") for cliente in (clientes_result.data or [])}

    result = (
        supabase.table("orcamentos")
        .select("id,cliente_id,numero_pedido,nome_orcamento,cliente_nome,status,valor_total,created_at")
        .eq("empresa_id", empresa_id)
        .order("created_at", desc=True)
        .limit(500)
        .execute()
    )

    termo = busca.strip().lower()
    lista = []
    for item in result.data or []:
        cliente_nome = cliente_por_id.get(item.get("cliente_id"), str(item.get("cliente_nome") or ""))
        numero = str(item.get("numero_pedido") or "")
        nome_orcamento = str(item.get("nome_orcamento") or "")
        texto_busca = f"{cliente_nome} {numero} {nome_orcamento}".lower()

        if termo and termo not in texto_busca:
            continue

        lista.append({
            "id": item.get("id"),
            "cliente_id": item.get("cliente_id"),
            "cliente_nome": cliente_nome,
            "numero_pedido": numero,
            "nome_orcamento": nome_orcamento or f"Orcamento {numero}",
            "status": item.get("status") or "rascunho",
            "valor_total": float(item.get("valor_total") or 0),
            "created_at": item.get("created_at"),
        })

    return lista


@router.post("/orcamentos")
def criar_orcamento(payload: dict):
    empresa_slug = str(payload.get("empresa_slug") or "").strip()
    cliente_nome = str(payload.get("cliente_nome") or "").strip()
    nome_orcamento = str(payload.get("nome_orcamento") or "").strip()

    if not cliente_nome:
        raise HTTPException(status_code=400, detail="Informe o nome do cliente")
    if not nome_orcamento:
        raise HTTPException(status_code=400, detail="Informe o nome do orcamento")

    supabase = get_supabase()
    empresa_id = buscar_empresa_id(supabase, empresa_slug)
    if not empresa_id:
        raise HTTPException(status_code=400, detail="Empresa nao identificada")

    cliente = buscar_ou_criar_cliente(supabase, empresa_id, cliente_nome)
    if not cliente:
        raise HTTPException(status_code=400, detail="Cliente nao criado")

    loja = buscar_loja_principal(supabase, empresa_id)
    numero_pedido = str(proximo_numero_orcamento(supabase, cliente["id"]))

    dados = {
        "empresa_id": empresa_id,
        "cliente_id": cliente["id"],
        "numero_pedido": numero_pedido,
        "nome_orcamento": nome_orcamento,
        "cliente_nome": cliente["nome"],
        "cliente_telefone": "",
        "status": "rascunho",
        "valor_total": 0,
        "dados": {},
    }
    if loja:
        dados["loja_id"] = loja["id"]

    try:
        result = supabase.table("orcamentos").insert(dados).execute()
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Erro na API: {error}") from error

    if not result.data:
        raise HTTPException(status_code=400, detail="Orcamento nao criado")
    return result.data[0]


@router.post("/usuarios")
def criar_usuario(payload: dict):
    try:
        result = get_supabase().rpc("criar_usuario_empresa", {"payload": payload}).execute()
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Erro na API: {error}") from error
    if not result.data:
        raise HTTPException(status_code=400, detail="Usuario nao criado")
    return result.data
