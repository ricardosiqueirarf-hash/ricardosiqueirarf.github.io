from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


CategoriaMaterial = Literal["perfil", "vidro", "puxador", "insumo", "trilho", "componente", "sistema", "outro"]
UnidadeCalculo = Literal["unidade", "metro_linear", "metro_quadrado", "kit", "par"]
OperadorRegra = Literal["contem_todas", "contem_qualquer"]


class TagCreate(BaseModel):
    empresa_slug: str = ""
    nome: str = Field(min_length=1)
    descricao: str = ""
    categorias_aplicaveis: list[CategoriaMaterial] = Field(default_factory=list)
    ativo: bool = True

    @field_validator("empresa_slug", "nome", "descricao", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def normalizar_categorias(self):
        self.categorias_aplicaveis = _lista_unica(self.categorias_aplicaveis)
        return self


class TagUpdate(TagCreate):
    id: str = Field(min_length=1)

    @field_validator("id", mode="before")
    @classmethod
    def strip_id(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class TagDelete(BaseModel):
    empresa_slug: str = ""
    id: str = Field(min_length=1)

    @field_validator("empresa_slug", "id", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class MaterialTagsUpdate(BaseModel):
    empresa_slug: str = ""
    material_id: str = Field(min_length=1)
    tag_ids: list[str] = Field(default_factory=list)

    @field_validator("empresa_slug", "material_id", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def normalizar_tag_ids(self):
        self.tag_ids = _lista_unica(self.tag_ids)
        return self


class RegraTagCreate(BaseModel):
    empresa_slug: str = ""
    nome: str = Field(min_length=1)
    descricao: str = ""
    categoria_a: CategoriaMaterial
    tag_ids_a: list[str] = Field(default_factory=list)
    categoria_b: CategoriaMaterial
    tag_ids_b: list[str] = Field(default_factory=list)
    operador: OperadorRegra = "contem_todas"
    cobranca_nome: str = ""
    unidade_calculo: UnidadeCalculo = "unidade"
    valor_unitario: float = Field(default=0, ge=0)
    ativo: bool = True
    configuracao: dict[str, Any] = Field(default_factory=dict)

    @field_validator("empresa_slug", "nome", "descricao", "categoria_a", "categoria_b", "operador", "cobranca_nome", "unidade_calculo", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def normalizar_tags(self):
        self.tag_ids_a = _lista_unica(self.tag_ids_a)
        self.tag_ids_b = _lista_unica(self.tag_ids_b)
        return self


class RegraTagUpdate(RegraTagCreate):
    id: str = Field(min_length=1)

    @field_validator("id", mode="before")
    @classmethod
    def strip_id(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class RegraTagDelete(BaseModel):
    empresa_slug: str = ""
    id: str = Field(min_length=1)

    @field_validator("empresa_slug", "id", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


def _lista_unica(lista: list[Any]) -> list[str]:
    normalizada: list[str] = []
    for item in lista or []:
        texto = str(item or "").strip()
        if texto and texto not in normalizada:
            normalizada.append(texto)
    return normalizada
