from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


PRODUTO_PORTA_GIRO = "porta_giro"


class ProdutoGlobalToggle(BaseModel):
    empresa_slug: str = ""
    produto_chave: str = PRODUTO_PORTA_GIRO
    ativo: bool = True

    @field_validator("empresa_slug", "produto_chave", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class PortaGiroPayload(BaseModel):
    empresa_slug: str = ""
    orcamento_id: str | None = None
    quantidade: int = Field(default=1, ge=1)
    largura: float = Field(gt=0)
    altura: float = Field(gt=0)
    perfil_id: str = Field(min_length=1)
    vidro_id: str = Field(min_length=1)
    puxador_id: str = "sem_puxador"
    medida_puxador: float = Field(default=0, ge=0)
    lado_puxador: str = "direito"
    altura_puxador: float = Field(default=1000, ge=0)
    dobradicas: int = Field(default=2, ge=2)
    valor_adicional: float = Field(default=0, ge=0)
    observacao_venda: str = ""
    observacao_producao: str = ""
    acessorio: str = ""

    @field_validator("empresa_slug", "orcamento_id", "perfil_id", "vidro_id", "puxador_id", "lado_puxador", "observacao_venda", "observacao_producao", "acessorio", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validar(self):
        if self.lado_puxador not in {"direito", "esquerdo"}:
            raise ValueError("lado_puxador deve ser direito ou esquerdo")
        if self.dobradicas < 2:
            raise ValueError("Porta de giro precisa de pelo menos 2 dobradicas")
        if self.altura <= 200:
            raise ValueError("Altura precisa ser maior que 200mm para distribuir dobradicas")
        if self.dobradicas > 12:
            raise ValueError("Quantidade de dobradicas muito alta")
        return self


class PortaGiroAdicionar(PortaGiroPayload):
    orcamento_id: str = Field(min_length=1)


class PortaGiroResultado(BaseModel):
    produto_chave: str
    nome: str
    quantidade: int
    valor_unitario: float
    valor_total: float
    custo_unitario: float
    custo_total: float
    margem: float
    margem_percentual: float
    medidas: dict[str, Any]
    dobradicas_alturas: list[float]
    linhas: list[dict[str, Any]]
