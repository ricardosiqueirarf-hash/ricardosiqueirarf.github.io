from app.repositories.common import supabase_client


def listar(empresa_id: str):
    result = supabase_client().table("orcamentos").select("id,cliente_id,numero_pedido,nome_orcamento,cliente_nome,status,valor_total,created_at").eq("empresa_id", empresa_id).order("created_at", desc=True).limit(500).execute()
    return result.data or []


def buscar(empresa_id: str, item_id: str):
    if not item_id:
        return None
    result = supabase_client().table("orcamentos").select("id,empresa_id,cliente_id,numero_pedido,nome_orcamento,cliente_nome,status,valor_total").eq("empresa_id", empresa_id).eq("id", item_id).limit(1).execute()
    return result.data[0] if result.data else None


def inserir(dados: dict):
    result = supabase_client().table("orcamentos").insert(dados).execute()
    return result.data[0] if result.data else None


def atualizar(empresa_id: str, item_id: str, dados: dict):
    result = supabase_client().table("orcamentos").update(dados).eq("empresa_id", empresa_id).eq("id", item_id).execute()
    return result.data[0] if result.data else None


def listar_linhas(empresa_id: str, item_id: str):
    result = supabase_client().table("orcamento_produtos").select("id,nome,quantidade,valor_unitario,valor_total,created_at").eq("empresa_id", empresa_id).eq("orcamento_id", item_id).order("created_at", desc=False).execute()
    return result.data or []


def inserir_linha(dados: dict):
    result = supabase_client().table("orcamento_produtos").insert(dados).execute()
    return result.data[0] if result.data else None


def atualizar_total(item_id: str, total: float):
    supabase_client().table("orcamentos").update({"valor_total": total}).eq("id", item_id).execute()
