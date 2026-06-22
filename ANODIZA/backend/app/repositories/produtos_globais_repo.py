from app.repositories.common import supabase_client


GLOBAL_SELECT = "id,empresa_id,produto_chave,ativo,configuracao,created_at,updated_at"


def listar_configuracoes(empresa_id: str):
    result = (
        supabase_client()
        .table("produtos_globais_empresa")
        .select(GLOBAL_SELECT)
        .eq("empresa_id", empresa_id)
        .execute()
    )
    return result.data or []


def buscar_configuracao(empresa_id: str, produto_chave: str):
    result = (
        supabase_client()
        .table("produtos_globais_empresa")
        .select(GLOBAL_SELECT)
        .eq("empresa_id", empresa_id)
        .eq("produto_chave", produto_chave)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def upsert_configuracao(empresa_id: str, produto_chave: str, ativo: bool, configuracao: dict | None = None):
    dados = {
        "empresa_id": empresa_id,
        "produto_chave": produto_chave,
        "ativo": ativo,
        "configuracao": configuracao or {},
    }
    result = (
        supabase_client()
        .table("produtos_globais_empresa")
        .upsert(dados, on_conflict="empresa_id,produto_chave")
        .execute()
    )
    return result.data[0] if result.data else buscar_configuracao(empresa_id, produto_chave)
