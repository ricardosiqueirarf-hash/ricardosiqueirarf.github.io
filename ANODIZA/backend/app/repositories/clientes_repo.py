from app.repositories.common import supabase_client


def listar_clientes(empresa_id: str):
    return (
        supabase_client()
        .table("clientes")
        .select("id,nome,documento,email,telefone,ativo")
        .eq("empresa_id", empresa_id)
        .order("created_at", desc=False)
        .execute()
        .data
        or []
    )


def buscar_cliente(empresa_id: str, cliente_id: str):
    if not cliente_id:
        return None
    result = (
        supabase_client()
        .table("clientes")
        .select("id,nome,documento,email,telefone,ativo")
        .eq("empresa_id", empresa_id)
        .eq("id", cliente_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def buscar_por_nome(empresa_id: str, nome: str):
    result = (
        supabase_client()
        .table("clientes")
        .select("id,nome,documento,email,telefone,ativo")
        .eq("empresa_id", empresa_id)
        .ilike("nome", nome)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def criar_cliente(dados: dict):
    result = supabase_client().table("clientes").insert(dados).execute()
    return result.data[0] if result.data else None


def editar_cliente(empresa_id: str, cliente_id: str, dados: dict):
    result = (
        supabase_client()
        .table("clientes")
        .update(dados)
        .eq("empresa_id", empresa_id)
        .eq("id", cliente_id)
        .execute()
    )
    return result.data[0] if result.data else None
