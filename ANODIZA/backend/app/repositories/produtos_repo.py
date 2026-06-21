from app.repositories.common import supabase_client


PRODUTO_SELECT = "id,empresa_id,nome,descricao,ativo,configuracao,created_at,updated_at"


def listar(empresa_id: str, ativos_apenas: bool = False, limit: int = 1000, offset: int = 0):
    query = (
        supabase_client()
        .table("produtos_configuraveis")
        .select(PRODUTO_SELECT)
        .eq("empresa_id", empresa_id)
        .order("nome", desc=False)
        .range(offset, offset + limit - 1)
    )
    if ativos_apenas:
        query = query.eq("ativo", True)
    return query.execute().data or []


def buscar(empresa_id: str, produto_id: str):
    if not produto_id:
        return None
    result = (
        supabase_client()
        .table("produtos_configuraveis")
        .select(PRODUTO_SELECT)
        .eq("empresa_id", empresa_id)
        .eq("id", produto_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def buscar_por_nome(empresa_id: str, nome: str):
    result = (
        supabase_client()
        .table("produtos_configuraveis")
        .select(PRODUTO_SELECT)
        .eq("empresa_id", empresa_id)
        .ilike("nome", nome)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def criar(dados: dict):
    result = supabase_client().table("produtos_configuraveis").insert(dados).execute()
    return result.data[0] if result.data else None


def editar(empresa_id: str, produto_id: str, dados: dict):
    result = (
        supabase_client()
        .table("produtos_configuraveis")
        .update(dados)
        .eq("empresa_id", empresa_id)
        .eq("id", produto_id)
        .execute()
    )
    return result.data[0] if result.data else None


def excluir(empresa_id: str, produto_id: str):
    result = (
        supabase_client()
        .table("produtos_configuraveis")
        .delete()
        .eq("empresa_id", empresa_id)
        .eq("id", produto_id)
        .execute()
    )
    return result.data[0] if result.data else None
