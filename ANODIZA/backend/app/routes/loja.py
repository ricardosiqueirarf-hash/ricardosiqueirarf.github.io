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


def buscar_loja(supabase, empresa_id: str, loja_id: str):
    if not loja_id:
        return None
    loja_result = (
        supabase.table("lojas")
        .select("id,nome")
        .eq("empresa_id", empresa_id)
        .eq("id", loja_id)
        .limit(1)
        .execute()
    )
    if not loja_result.data:
        return None
    return loja_result.data[0]


def proximo_numero_orcamento(supabase, loja_id: str) -> int:
    result = supabase.table("orcamentos").select("numero_pedido").eq("loja_id", loja_id).limit(2000).execute()
    maior = 0
    for item in result.data or []:
        numero = str(item.get("numero_pedido") or "").strip()
        if numero.isdigit():
            maior = max(maior, int(numero))
    return maior + 1


@router.get("/lojas")
def listar_lojas(empresa_slug: str = Query(default="")):
    supabase = get_supabase()
    empresa_id = buscar_empresa_id(supabase, empresa_slug)
    if not empresa_id:
        return []

    result = supabase.table("lojas").select("id,nome,slug").eq("empresa_id", empresa_id).order("created_at", desc=False).execute()
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

    lojas_result = supabase.table("lojas").select("id,nome").eq("empresa_id", empresa_id).execute()
    loja_por_id = {loja["id"]: loja.get("nome", "") for loja in (lojas_result.data or [])}

    result = (
        supabase.table("orcamentos")
        .select("id,loja_id,numero_pedido,cliente_nome,status,valor_total,created_at")
        .eq("empresa_id", empresa_id)
        .order("created_at", desc=True)
        .limit(500)
        .execute()
    )

    termo = busca.strip().lower()
    lista = []
    for item in result.data or []:
        loja_nome = loja_por_id.get(item.get("loja_id"), "Loja nao identificada")
        numero = str(item.get("numero_pedido") or "")
        cliente_nome = str(item.get("cliente_nome") or "")
        texto_busca = f"{loja_nome} {numero} {cliente_nome}".lower()

        if termo and termo not in texto_busca:
            continue

        lista.append({
            "id": item.get("id"),
            "loja_id": item.get("loja_id"),
            "loja_nome": loja_nome,
            "numero_pedido": numero,
            "cliente_nome": cliente_nome,
            "status": item.get("status") or "rascunho",
            "valor_total": float(item.get("valor_total") or 0),
            "created_at": item.get("created_at"),
        })

    return lista


@router.post("/orcamentos")
def criar_orcamento(payload: dict):
    empresa_slug = str(payload.get("empresa_slug") or "").strip()
    loja_id = str(payload.get("loja_id") or "").strip()
    cliente_nome = str(payload.get("cliente_nome") or "").strip()

    if not cliente_nome:
        raise HTTPException(status_code=400, detail="Informe o nome do cliente")
    if not loja_id:
        raise HTTPException(status_code=400, detail="Selecione a loja")

    supabase = get_supabase()
    empresa_id = buscar_empresa_id(supabase, empresa_slug)
    if not empresa_id:
        raise HTTPException(status_code=400, detail="Empresa nao identificada")

    loja = buscar_loja(supabase, empresa_id, loja_id)
    if not loja:
        raise HTTPException(status_code=400, detail="Loja nao encontrada para esta empresa")

    numero_pedido = str(proximo_numero_orcamento(supabase, loja_id))

    try:
        result = supabase.table("orcamentos").insert({
            "empresa_id": empresa_id,
            "loja_id": loja_id,
            "numero_pedido": numero_pedido,
            "cliente_nome": cliente_nome,
            "cliente_telefone": "",
            "status": "rascunho",
            "valor_total": 0,
            "dados": {},
        }).execute()
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
