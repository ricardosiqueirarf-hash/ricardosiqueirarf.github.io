from datetime import datetime, timezone
from typing import Any


SNAPSHOT_SCHEMA = "orcamento_produto_v1"


def agora_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def numero(valor: Any, padrao: float = 0.0) -> float:
    try:
        if valor is None or valor == "":
            return padrao
        return float(valor)
    except (TypeError, ValueError):
        return padrao


def montar_snapshot_linha_orcamento(
    *,
    produto_id: str | None,
    produto_nome: str,
    produto_origem: str,
    produto_versao_id: str | None = None,
    produto_versao_numero: int | None = 1,
    valores_preenchidos: dict | None = None,
    configuracao_snapshot: dict | None = None,
    calculo_snapshot: dict | None = None,
    materiais_snapshot: list | None = None,
    custo_total: float | int | None = 0,
    margem_total: float | int | None = None,
    margem_percentual: float | int | None = 0,
    valor_unitario: float | int | None = 0,
    valor_total: float | int | None = 0,
    extras: dict | None = None,
) -> dict:
    """Snapshot padrao de linha de orcamento.

    O objetivo eh congelar o resultado usado no momento da venda. Este objeto
    continua em dados jsonb para nao depender de migration aplicada no Supabase.
    Campos antigos ficam como alias para manter compatibilidade com o frontend
    e com calculos ja existentes.
    """
    valor_unitario_float = round(numero(valor_unitario), 2)
    valor_total_float = round(numero(valor_total), 2)
    custo_total_float = round(numero(custo_total), 2)
    if margem_total is None:
        margem_total_float = round(valor_total_float - custo_total_float, 2) if custo_total_float else 0.0
    else:
        margem_total_float = round(numero(margem_total), 2)

    snapshot = {
        "snapshot_schema": SNAPSHOT_SCHEMA,
        "produto_id": produto_id,
        "produto_nome": produto_nome,
        "nome_produto_snapshot": produto_nome,
        "produto_origem": produto_origem,
        "produto_versao_id": produto_versao_id,
        "produto_versao_numero": produto_versao_numero or 1,
        "valores_preenchidos": valores_preenchidos or {},
        "valores": valores_preenchidos or {},
        "configuracao_snapshot": configuracao_snapshot or {},
        "calculo_snapshot": calculo_snapshot or {},
        "calculo": calculo_snapshot or {},
        "materiais_snapshot": materiais_snapshot or [],
        "custo_total": custo_total_float,
        "margem_total": margem_total_float,
        "margem": margem_total_float,
        "margem_percentual": round(numero(margem_percentual), 2),
        "valor_unitario": valor_unitario_float,
        "valor_total": valor_total_float,
        "congelado_em": agora_utc_iso(),
    }
    if extras:
        snapshot.update(extras)
    return snapshot


def snapshot_manual(nome: str, quantidade: float, valor_unitario: float) -> dict:
    valor_total = numero(quantidade, 1) * numero(valor_unitario)
    calculo = {
        "produto_origem": "manual",
        "nome": nome,
        "quantidade": numero(quantidade, 1),
        "valor_unitario": round(numero(valor_unitario), 2),
        "valor_total": round(valor_total, 2),
        "custo_unitario": 0,
        "custo_total": 0,
        "margem": 0,
        "margem_percentual": 0,
        "linhas": [],
    }
    return montar_snapshot_linha_orcamento(
        produto_id=None,
        produto_nome=nome,
        produto_origem="manual",
        produto_versao_id=None,
        produto_versao_numero=1,
        valores_preenchidos={"nome": nome, "quantidade": quantidade, "valor_unitario": valor_unitario},
        configuracao_snapshot={"tipo": "manual"},
        calculo_snapshot=calculo,
        materiais_snapshot=[],
        custo_total=0,
        margem_total=0,
        margem_percentual=0,
        valor_unitario=valor_unitario,
        valor_total=valor_total,
    )


def normalizar_snapshot_de_linha(dados_linha: dict) -> dict:
    """Normaliza dados jsonb antes de inserir em orcamento_produtos.

    Centralizar aqui garante que produto local, produto global e produto manual
    passem a ter o mesmo envelope minimo de snapshot sem refatorar os services
    existentes nem depender das colunas novas da migration 010.
    """
    dados = dados_linha.get("dados") if isinstance(dados_linha.get("dados"), dict) else {}
    if not dados:
        return snapshot_manual(
            str(dados_linha.get("nome") or "Produto manual"),
            numero(dados_linha.get("quantidade"), 1),
            numero(dados_linha.get("valor_unitario")),
        )

    calculo = dados.get("calculo_snapshot") or dados.get("calculo") or {}
    if not isinstance(calculo, dict):
        calculo = {}

    produto_nome = (
        dados.get("produto_nome")
        or dados.get("nome_produto_snapshot")
        or calculo.get("nome")
        or dados_linha.get("nome")
        or "Produto"
    )
    produto_origem = dados.get("produto_origem") or calculo.get("produto_origem") or "manual"
    valores = dados.get("valores_preenchidos") or dados.get("valores") or calculo.get("valores") or {}
    configuracao = dados.get("configuracao_snapshot") or calculo.get("configuracao_snapshot") or {}
    materiais = dados.get("materiais_snapshot") or calculo.get("materiais_snapshot") or []
    custo_total = dados.get("custo_total", calculo.get("custo_total", 0))
    margem_total = dados.get("margem_total", dados.get("margem", calculo.get("margem")))
    margem_percentual = dados.get("margem_percentual", calculo.get("margem_percentual", 0))

    snapshot = montar_snapshot_linha_orcamento(
        produto_id=dados.get("produto_id") or calculo.get("produto_id"),
        produto_nome=str(produto_nome),
        produto_origem=str(produto_origem),
        produto_versao_id=dados.get("produto_versao_id") or calculo.get("produto_versao_id"),
        produto_versao_numero=dados.get("produto_versao_numero") or calculo.get("produto_versao_numero") or 1,
        valores_preenchidos=valores if isinstance(valores, dict) else {},
        configuracao_snapshot=configuracao if isinstance(configuracao, dict) else {},
        calculo_snapshot=calculo,
        materiais_snapshot=materiais if isinstance(materiais, list) else [],
        custo_total=custo_total,
        margem_total=margem_total,
        margem_percentual=margem_percentual,
        valor_unitario=dados.get("valor_unitario", dados_linha.get("valor_unitario", calculo.get("valor_unitario", 0))),
        valor_total=dados.get("valor_total", dados_linha.get("valor_total", calculo.get("valor_total", 0))),
        extras=dados,
    )
    snapshot.setdefault("congelado_em", agora_utc_iso())
    return snapshot
