from app.repositories.common import supabase_client
from app.services.snapshot_service import normalizar_snapshot_de_linha


ORCAMENTO_SELECT = "id,empresa_id,loja_id,usuario_id,cliente_id,numero_pedido,nome_orcamento,cliente_nome,cliente_documento,cliente_telefone,status,valor_total,dados,created_at,updated_at"
LINHA_SELECT = "id,nome,quantidade,valor_unitario,valor_total,dados,created_at"


def listar(empresa_id: str, limit: int = 500, offset: int = 0):
    result = (
        supabase_client()
        .table("orcamentos")
        .select(ORCAMENTO_SELECT)
        .eq("empresa_id", empresa_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data or []


def buscar(empresa_id: str, item_id: str):
    if not item_id:
        return None
    result = (
        supabase_client()
        .table("orcamentos")
        .select(ORCAMENTO_SELECT)
        .eq("empresa_id", empresa_id)
        .eq("id", item_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def inserir(empresa_id: str, dados: dict):
    dados = {**dados, "empresa_id": empresa_id}
    result = supabase_client().table("orcamentos").insert(dados).execute()
    return result.data[0] if result.data else None


def atualizar(empresa_id: str, item_id: str, dados: dict):
    result = supabase_client().table("orcamentos").update(dados).eq("empresa_id", empresa_id).eq("id", item_id).execute()
    return result.data[0] if result.data else None


def listar_linhas(empresa_id: str, item_id: str, limit: int = 500, offset: int = 0):
    result = (
        supabase_client()
        .table("orcamento_produtos")
        .select(LINHA_SELECT)
        .eq("empresa_id", empresa_id)
        .eq("orcamento_id", item_id)
        .order("created_at", desc=False)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data or []


def listar_linhas_por_orcamentos(empresa_id: str, orcamento_ids: list[str]):
    if not orcamento_ids:
        return []
    result = (
        supabase_client()
        .table("orcamento_produtos")
        .select("orcamento_id," + LINHA_SELECT)
        .eq("empresa_id", empresa_id)
        .in_("orcamento_id", orcamento_ids)
        .limit(10000)
        .execute()
    )
    return result.data or []


def inserir_linha(empresa_id: str, dados: dict):
    dados = {**dados, "empresa_id": empresa_id}
    dados["dados"] = normalizar_snapshot_de_linha(dados)
    result = supabase_client().table("orcamento_produtos").insert(dados).execute()
    return result.data[0] if result.data else None


def atualizar_total(empresa_id: str, item_id: str, total: float, dados: dict | None = None):
    payload = {"valor_total": total}
    if dados is not None:
        payload["dados"] = dados
    supabase_client().table("orcamentos").update(payload).eq("empresa_id", empresa_id).eq("id", item_id).execute()


def listar_numeros_por_empresa(empresa_id: str):
    result = (
        supabase_client()
        .table("orcamentos")
        .select("numero_pedido")
        .eq("empresa_id", empresa_id)
        .limit(5000)
        .execute()
    )
    return result.data or []


def listar_numeros_por_cliente(empresa_id: str, cliente_id: str):
    result = (
        supabase_client()
        .table("orcamentos")
        .select("numero_pedido")
        .eq("empresa_id", empresa_id)
        .eq("cliente_id", cliente_id)
        .limit(2000)
        .execute()
    )
    return result.data or []


def listar_usuarios_resumo(empresa_id: str):
    result = (
        supabase_client()
        .table("usuarios")
        .select("id,nome,email")
        .eq("empresa_id", empresa_id)
        .limit(5000)
        .execute()
    )
    return result.data or []
