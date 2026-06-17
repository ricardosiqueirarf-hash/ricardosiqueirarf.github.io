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


@router.get("/usuarios")
def listar_usuarios(empresa_slug: str = Query(default="")):
    if not empresa_slug:
        return []

    supabase = get_supabase()
    empresa_result = supabase.table("empresas").select("id").eq("slug", empresa_slug).limit(1).execute()
    if not empresa_result.data:
        return []

    empresa_id = empresa_result.data[0]["id"]
    result = supabase.table("usuarios").select("id,nome,email,perfil,ativo,loja_id").eq("empresa_id", empresa_id).order("created_at", desc=False).execute()
    return result.data or []


@router.post("/usuarios")
def criar_usuario(payload: dict):
    try:
        result = get_supabase().rpc("criar_usuario_empresa", {"payload": payload}).execute()
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Erro na API: {error}") from error
    if not result.data:
        raise HTTPException(status_code=400, detail="Usuario nao criado")
    return result.data
