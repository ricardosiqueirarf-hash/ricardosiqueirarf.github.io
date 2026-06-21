from app.repositories.common import supabase_client


MATERIAL_SELECT = "id,empresa_id,categoria,nome,codigo,unidade,custo_unitario,margem_percentual,perda_percentual,preco_unitario,ativo,configuracao,created_at,updated_at"


def listar_materiais(empresa_id: str, categoria: str | None = None, ativos_apenas: bool = False, limit: int = 1000, offset: int = 0):
    query = (
        supabase_client()
        .table("materiais")
        .select(MATERIAL_SELECT)
        .eq("empresa_id", empresa_id)
        .order("categoria", desc=False)
        .order("nome", desc=False)
        .range(offset, offset + limit - 1)
    )

    if categoria:
        query = query.eq("categoria", categoria)

    if ativos_apenas:
        query = query.eq("ativo", True)

    return query.execute().data or []


def buscar_material(empresa_id: str, material_id: str):
    if not material_id:
        return None

    result = (
        supabase_client()
        .table("materiais")
        .select(MATERIAL_SELECT)
        .eq("empresa_id", empresa_id)
        .eq("id", material_id)
        .limit(1)
        .execute()
    )

    return result.data[0] if result.data else None


def buscar_por_nome_categoria(empresa_id: str, categoria: str, nome: str):
    result = (
        supabase_client()
        .table("materiais")
        .select(MATERIAL_SELECT)
        .eq("empresa_id", empresa_id)
        .eq("categoria", categoria)
        .ilike("nome", nome)
        .limit(1)
        .execute()
    )

    return result.data[0] if result.data else None


def criar_material(dados: dict):
    result = supabase_client().table("materiais").insert(dados).execute()
    return result.data[0] if result.data else None


def editar_material(empresa_id: str, material_id: str, dados: dict):
    result = (
        supabase_client()
        .table("materiais")
        .update(dados)
        .eq("empresa_id", empresa_id)
        .eq("id", material_id)
        .execute()
    )

    return result.data[0] if result.data else None


def excluir_material(empresa_id: str, material_id: str):
    result = (
        supabase_client()
        .table("materiais")
        .delete()
        .eq("empresa_id", empresa_id)
        .eq("id", material_id)
        .execute()
    )

    return result.data[0] if result.data else None
