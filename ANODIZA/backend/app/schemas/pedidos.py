from pydantic import BaseModel


class PedidoCreate(BaseModel):
    empresa_slug: str = ""
    nome_orcamento: str
    cliente_id: str


class PedidoUpdate(PedidoCreate):
    id: str


class PedidoProdutoCreate(BaseModel):
    empresa_slug: str = ""
    orcamento_id: str
    nome: str
    quantidade: float = 1
    valor_unitario: float = 0
