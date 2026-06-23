import re
from datetime import date
from decimal import Decimal
from typing import Any

from app.external_apis.conta_azul.contracts import ApprovedSale, SoldCustomer, SoldItem


def apenas_digitos(valor: Any) -> str:
    return re.sub(r"\D+", "", str(valor or ""))


def money(value: Any) -> Decimal:
    """Converte valores numericos do banco para Decimal de forma segura."""

    if value in (None, ""):
        return Decimal("0")
    return Decimal(str(value))


def decimal_to_float(value: Decimal | int | float | str) -> float:
    return float(money(value))


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


def to_conta_azul_person_payload(sale: ApprovedSale) -> dict[str, Any]:
    """Converte o comprador do ANODIZA para o payload de pessoa da Conta Azul."""

    documento = apenas_digitos(sale.cliente.documento)
    tipo_pessoa = "Jurídica" if len(documento) == 14 else "Física"
    payload: dict[str, Any] = {
        "nome": sale.cliente.nome,
        "tipo_pessoa": tipo_pessoa,
        "ativo": True,
        "perfis": [{"tipo_perfil": "Cliente"}],
        "codigo": f"ANODIZA-{sale.cliente.id[:8]}" if sale.cliente.id else None,
        "email": sale.cliente.email or None,
        "telefone_comercial": apenas_digitos(sale.cliente.telefone) or None,
        "observacao": f"Cliente sincronizado pelo ANODIZA. Orcamento origem: {sale.numero_pedido or sale.orcamento_id}",
    }
    if len(documento) == 14:
        payload["cnpj"] = documento
    elif len(documento) == 11:
        payload["cpf"] = documento

    return {key: value for key, value in payload.items() if value not in (None, "")}


def to_conta_azul_sale_payload(
    sale: ApprovedSale,
    conta_azul_customer_id: str,
    conta_azul_item_id: str,
    numero_venda: int,
    data_venda: str | None = None,
    tipo_pagamento: str = "SEM_PAGAMENTO",
    opcao_condicao_pagamento: str = "À vista",
) -> dict[str, Any]:
    """Converte venda aprovada do ANODIZA para payload de venda da Conta Azul.

    A Conta Azul exige `itens.id`. No MVP usamos um item/produto padrao configurado
    por empresa em `settings.default_item_id`.
    """

    vencimento = data_venda or date.today().isoformat()
    return {
        "id_cliente": conta_azul_customer_id,
        "numero": int(numero_venda),
        "situacao": "APROVADO",
        "data_venda": vencimento,
        "observacoes": (
            f"Venda originada no ANODIZA. "
            f"Orcamento: {sale.numero_pedido or sale.orcamento_id}. "
            f"Aprovado por: {sale.aprovado_por_nome or '-'}"
        ),
        "itens": [
            {
                "id": conta_azul_item_id,
                "descricao": item.nome,
                "quantidade": decimal_to_float(item.quantidade),
                "valor": decimal_to_float(item.valor_total or item.valor_unitario),
            }
            for item in sale.itens
        ],
        "condicao_pagamento": {
            "tipo_pagamento": tipo_pagamento,
            "opcao_condicao_pagamento": opcao_condicao_pagamento,
            "parcelas": [
                {
                    "data_vencimento": vencimento,
                    "valor": decimal_to_float(sale.valor_total),
                    "descricao": f"Pedido ANODIZA {sale.numero_pedido or sale.orcamento_id}",
                }
            ],
        },
    }
