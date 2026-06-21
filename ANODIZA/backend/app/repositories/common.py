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


def garantir_loja_operacional(empresa_id: str):
    loja = buscar_loja_principal(empresa_id)
    if loja:
        return loja

    slug = f"operacao-principal-{str(empresa_id)[:8]}"
    dados = {
        "empresa_id": empresa_id,
        "nome": "Operacao principal",
        "slug": slug,
        "endereco": {},
        "status": "ativa",
    }

    try:
        result = supabase_client().table("lojas").insert(dados).execute()
        if result.data:
            return result.data[0]
    except Exception:
        loja = buscar_loja_principal(empresa_id)
        if loja:
            return loja
        raise

    return buscar_loja_principal(empresa_id)
