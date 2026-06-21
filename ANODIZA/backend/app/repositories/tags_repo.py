from app.repositories.common import supabase_client


TAG_SELECT = "id,empresa_id,nome,descricao,categorias_aplicaveis,ativo,created_at,updated_at"
MATERIAL_TAG_SELECT = "id,empresa_id,material_id,tag_id,created_at"
REGRA_SELECT = "id,empresa_id,nome,descricao,categoria_a,tag_ids_a,categoria_b,tag_ids_b,operador,cobranca_nome,unidade_calculo,valor_unitario,ativo,configuracao,created_at,updated_at"


def listar_tags(empresa_id: str, ativos_apenas: bool = False):
    query = (
        supabase_client()
        .table("tags")
        .select(TAG_SELECT)
        .eq("empresa_id", empresa_id)
        .order("nome", desc=False)
    )

    if ativos_apenas:
        query = query.eq("ativo", True)

    return query.execute().data or []


def buscar_tag(empresa_id: str, tag_id: str):
    if not tag_id:
        return None

    result = (
        supabase_client()
        .table("tags")
        .select(TAG_SELECT)
        .eq("empresa_id", empresa_id)
        .eq("id", tag_id)
        .limit(1)
        .execute()
    )

    return result.data[0] if result.data else None


def buscar_tag_por_nome(empresa_id: str, nome: str):
    result = (
        supabase_client()
        .table("tags")
        .select(TAG_SELECT)
        .eq("empresa_id", empresa_id)
        .ilike("nome", nome)
        .limit(1)
        .execute()
    )

    return result.data[0] if result.data else None


def criar_tag(dados: dict):
    result = supabase_client().table("tags").insert(dados).execute()
    return result.data[0] if result.data else None


def editar_tag(empresa_id: str, tag_id: str, dados: dict):
    result = (
        supabase_client()
        .table("tags")
        .update(dados)
        .eq("empresa_id", empresa_id)
        .eq("id", tag_id)
        .execute()
    )

    return result.data[0] if result.data else None


def excluir_tag(empresa_id: str, tag_id: str):
    result = (
        supabase_client()
        .table("tags")
        .delete()
        .eq("empresa_id", empresa_id)
        .eq("id", tag_id)
        .execute()
    )

    return result.data[0] if result.data else None


def listar_material_tags(empresa_id: str):
    return (
        supabase_client()
        .table("material_tags")
        .select(MATERIAL_TAG_SELECT)
        .eq("empresa_id", empresa_id)
        .execute()
        .data
        or []
    )


def listar_tags_do_material(empresa_id: str, material_id: str):
    return (
        supabase_client()
        .table("material_tags")
        .select(MATERIAL_TAG_SELECT)
        .eq("empresa_id", empresa_id)
        .eq("material_id", material_id)
        .execute()
        .data
        or []
    )


def substituir_tags_material(empresa_id: str, material_id: str, tag_ids: list[str]):
    supabase_client().table("material_tags").delete().eq("empresa_id", empresa_id).eq("material_id", material_id).execute()

    if not tag_ids:
        return []

    linhas = [{"empresa_id": empresa_id, "material_id": material_id, "tag_id": tag_id} for tag_id in tag_ids]
    result = supabase_client().table("material_tags").insert(linhas).execute()
    return result.data or []


def listar_regras(empresa_id: str, ativos_apenas: bool = False):
    query = (
        supabase_client()
        .table("tag_regras")
        .select(REGRA_SELECT)
        .eq("empresa_id", empresa_id)
        .order("nome", desc=False)
    )

    if ativos_apenas:
        query = query.eq("ativo", True)

    return query.execute().data or []


def buscar_regra(empresa_id: str, regra_id: str):
    if not regra_id:
        return None

    result = (
        supabase_client()
        .table("tag_regras")
        .select(REGRA_SELECT)
        .eq("empresa_id", empresa_id)
        .eq("id", regra_id)
        .limit(1)
        .execute()
    )

    return result.data[0] if result.data else None


def buscar_regra_por_nome(empresa_id: str, nome: str):
    result = (
        supabase_client()
        .table("tag_regras")
        .select(REGRA_SELECT)
        .eq("empresa_id", empresa_id)
        .ilike("nome", nome)
        .limit(1)
        .execute()
    )

    return result.data[0] if result.data else None


def criar_regra(dados: dict):
    result = supabase_client().table("tag_regras").insert(dados).execute()
    return result.data[0] if result.data else None


def editar_regra(empresa_id: str, regra_id: str, dados: dict):
    result = (
        supabase_client()
        .table("tag_regras")
        .update(dados)
        .eq("empresa_id", empresa_id)
        .eq("id", regra_id)
        .execute()
    )

    return result.data[0] if result.data else None


def excluir_regra(empresa_id: str, regra_id: str):
    result = (
        supabase_client()
        .table("tag_regras")
        .delete()
        .eq("empresa_id", empresa_id)
        .eq("id", regra_id)
        .execute()
    )

    return result.data[0] if result.data else None
