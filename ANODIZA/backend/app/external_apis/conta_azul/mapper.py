from decimal import Decimal
from typing import Any

from app.external_apis.conta_azul.contracts import ApprovedSale, SoldCustomer, SoldItem


def money(value: Any) -> Decimal:
    """Converte valores numericos do banco para Decimal de forma segura."""

    if value in (None, ""):
        return Decimal("0")
    return Decimal(str(value))


def build_approved_sale_contract(orcamento: dict[str, Any], itens: list[dict[str, Any]]) -> ApprovedSale:
    """Monta o contrato interno de venda aprovada.

    Entrada esperada:
    - registro da tabela `orcamentos`;
    - registros da tabela `orcamento_produtos`.

    Saida:
    - contrato padronizado para qualquer API externa.
    """

    dados = orcamento.get("dados") or {}
    cliente = SoldCustomer(
        id=str(orcamento.get("cliente_id") or ""),
        nome=str(orcamento.get("cliente_nome") or "").strip(),
        documento=str(orcamento.get("cliente_documento") or "").strip(),
        telefone=str(orcamento.get("cliente_telefone") or "").strip(),
        email=str(dados.get("cliente_email") or "").strip(),
    )

    sold_items = [
        SoldItem(
            id=str(item.get("id") or ""),
            nome=str(item.get("nome") or "Produto sob medida").strip(),
            quantidade=money(item.get("quantidade") or 1),
            valor_unitario=money(item.get("valor_unitario")),
            valor_total=money(item.get("valor_total")),
            metadata=item.get("dados") or {},
        )
        for item in itens
    ]

    if not sold_items:
        sold_items = [
            SoldItem(
                nome=str(orcamento.get("nome_orcamento") or "Produto sob medida").strip(),
                quantidade=Decimal("1"),
                valor_unitario=money(orcamento.get("valor_total")),
                valor_total=money(orcamento.get("valor_total")),
            )
        ]

    return ApprovedSale(
        empresa_id=str(orcamento.get("empresa_id") or ""),
        loja_id=str(orcamento.get("loja_id") or "") or None,
        orcamento_id=str(orcamento.get("id") or ""),
        cliente=cliente,
        numero_pedido=str(orcamento.get("numero_pedido") or ""),
        nome_orcamento=str(orcamento.get("nome_orcamento") or ""),
        status=str(orcamento.get("status") or "aprovado"),
        valor_total=money(orcamento.get("valor_total")),
        aprovado_em=str(dados.get("aprovado_em") or ""),
        aprovado_por=str(dados.get("aprovado_por") or ""),
        aprovado_por_nome=str(dados.get("aprovado_por_nome") or ""),
        itens=sold_items,
        metadata={
            "source": "anodiza",
            "source_entity": "orcamento",
            "source_entity_id": str(orcamento.get("id") or ""),
        },
    )


def to_conta_azul_customer_payload(sale: ApprovedSale) -> dict[str, Any]:
    """Converte o comprador do ANODIZA para payload-base de pessoa na Conta Azul.

    O payload final deve ser ajustado conforme o endpoint escolhido na documentacao
    vigente da Conta Azul.
    """

    return {
        "name": sale.cliente.nome,
        "document": sale.cliente.documento or None,
        "email": sale.cliente.email or None,
        "phone": sale.cliente.telefone or None,
        "external_reference": sale.cliente.id,
    }


def to_conta_azul_sale_payload(sale: ApprovedSale, conta_azul_customer_id: str) -> dict[str, Any]:
    """Converte venda aprovada do ANODIZA para payload-base de venda na Conta Azul."""

    return {
        "customer_id": conta_azul_customer_id,
        "external_reference": sale.orcamento_id,
        "number": sale.numero_pedido,
        "description": sale.nome_orcamento or f"Orcamento {sale.numero_pedido}",
        "notes": sale.observacoes,
        "total": str(sale.valor_total),
        "items": [
            {
                "name": item.nome,
                "quantity": str(item.quantidade),
                "unit_price": str(item.valor_unitario),
                "total": str(item.valor_total),
                "external_reference": item.id,
            }
            for item in sale.itens
        ],
        "metadata": sale.metadata,
    }
