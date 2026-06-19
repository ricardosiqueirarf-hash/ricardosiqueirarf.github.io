from pydantic import BaseModel, Field, field_validator


class PedidoCreate(BaseModel):
    empresa_slug: str = ""
    nome_orcamento: str = Field(min_length=1)
    cliente_id: str = Field(min_length=1)

    @field_validator("empresa_slug", "nome_orcamento", "cliente_id", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class PedidoUpdate(PedidoCreate):
    id: str = Field(min_length=1)

    @field_validator("id", mode="before")
    @classmethod
    def strip_id(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class PedidoProdutoCreate(BaseModel):
    empresa_slug: str = ""
    orcamento_id: str = Field(min_length=1)
    nome: str = Field(min_length=1)
    quantidade: float = Field(default=1, gt=0)
    valor_unitario: float = Field(default=0, ge=0)

    @field_validator("empresa_slug", "orcamento_id", "nome", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value
