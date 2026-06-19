from app.repositories.common import supabase_client


def listar(empresa_id: str):
    result = supabase_client().table("usuarios").select("id,nome,email,perfil,ativo,loja_id,permissoes").eq("empresa_id", empresa_id).order("created_at", desc=False).execute()
    return result.data or []


def buscar(empresa_id: str, pessoa_id: str):
    result = supabase_client().table("usuarios").select("id,nome,email,perfil,ativo,loja_id,permissoes").eq("empresa_id", empresa_id).eq("id", pessoa_id).limit(1).execute()
    return result.data[0] if result.data else None
