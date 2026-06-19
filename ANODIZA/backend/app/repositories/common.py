from app.db.supabase_client import get_supabase


def supabase_client():
    return get_supabase()


def buscar_loja_principal(empresa_id: str):
    result = (
        supabase_client()
        .table("lojas")
        .select("id,nome")
        .eq("empresa_id", empresa_id)
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None
