from app.repositories.common import supabase_client


def listar(empresa_id: str):
    result = supabase_client().table("orcamentos").select("id,cliente_id,numero_pedido,nome_orcamento,cliente_nome,status,valor_total,created_at").eq("empresa_id", empresa_id).order("created_at", desc=True).limit(500).execute()
    return result.data or []
