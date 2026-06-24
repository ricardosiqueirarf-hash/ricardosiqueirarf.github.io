from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class ExternalApiResult(BaseModel):
    """Resultado padronizado para qualquer integracao externa."""

    success: bool
    provider: str
    action: str
    external_id: str | None = None
    message: str = ""
    raw_response: dict[str, Any] = Field(default_factory=dict)


class SoldCustomer(BaseModel):
    """Comprador da venda aprovada no ANODIZA."""

    id: str
    nome: str
    documento: str = ""
    email: str = ""
    telefone: str = ""


class SoldItem(BaseModel):
    """Item comercial vendido.

    Na fase inicial, este item deve representar o produto vendido ao cliente,
    nao todos os insumos tecnicos usados na fabricacao.
    """

    id: str | None = None
    nome: str
    quantidade: Decimal = Decimal("1")
    valor_unitario: Decimal = Decimal("0")
    valor_total: Decimal = Decimal("0")
    metadata: dict[str, Any] = Field(default_factory=dict)


class ApprovedSale(BaseModel):
    """Contrato interno que qualquer API externa deve receber.

    Este contrato evita acoplamento direto entre o modelo interno do ANODIZA
    e o payload especifico de cada fornecedor externo.
    """

    empresa_id: str
    loja_id: str | None = None
    orcamento_id: str
    cliente: SoldCustomer
    numero_pedido: str = ""
    nome_orcamento: str = ""
    status: str = "aprovado"
    valor_total: Decimal = Decimal("0")
    aprovado_em: str = ""
    aprovado_por: str = ""
    aprovado_por_nome: str = ""
    itens: list[SoldItem] = Field(default_factory=list)
    observacoes: str = "Venda originada no ANODIZA."
    metadata: dict[str, Any] = Field(default_factory=dict)
