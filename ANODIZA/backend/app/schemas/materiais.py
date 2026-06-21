from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


CategoriaMaterial = Literal["perfil", "vidro", "puxador", "insumo", "trilho", "componente", "sistema", "outro"]
UnidadeMaterial = Literal["unidade", "metro_linear", "metro_quadrado", "kit", "par"]


class MaterialCreate(BaseModel):
    empresa_slug: str = ""
    categoria: CategoriaMaterial = "insumo"
    nome: str = Field(min_length=1)
    codigo: str = ""
    unidade: UnidadeMaterial = "unidade"
    custo_unitario: float = Field(default=0, ge=0)
    margem_percentual: float = Field(default=0, ge=0)
    perda_percentual: float = Field(default=0, ge=0)
    ativo: bool = True
    configuracao: dict[str, Any] = Field(default_factory=dict)

    @field_validator("empresa_slug", "categoria", "nome", "codigo", "unidade", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def normalize_configuracao(self):
        config = dict(self.configuracao or {})
        agregados = dict(config.get("agregados") or {})

        if self.categoria == "perfil":
            tipologias = config.get("tipologias") or []
            insumos_ids = config.get("insumos_ids") or []
            puxadores_ids = config.get("puxadores_ids") or agregados.get("puxador") or []

            config["tipologias"] = _normalizar_lista_texto(tipologias)
            config["insumos_ids"] = _normalizar_lista_texto(insumos_ids)
            config["puxadores_ids"] = _normalizar_lista_texto(puxadores_ids)
            agregados["puxador"] = config["puxadores_ids"]

        if self.categoria == "sistema":
            trilhos_ids = config.get("trilhos_ids") or agregados.get("trilho") or []
            perfis_ids = config.get("perfis_ids") or agregados.get("perfil") or []

            config["trilhos_ids"] = _normalizar_lista_texto(trilhos_ids)
            config["perfis_ids"] = _normalizar_lista_texto(perfis_ids)
            agregados["trilho"] = config["trilhos_ids"]
            agregados["perfil"] = config["perfis_ids"]

        config["agregados"] = {categoria: _normalizar_lista_texto(ids) for categoria, ids in agregados.items() if _normalizar_lista_texto(ids)}
        self.configuracao = config
        return self


class MaterialUpdate(MaterialCreate):
    id: str = Field(min_length=1)

    @field_validator("id", mode="before")
    @classmethod
    def strip_id(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class MaterialDelete(BaseModel):
    empresa_slug: str = ""
    id: str = Field(min_length=1)

    @field_validator("empresa_slug", "id", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


def _normalizar_lista_texto(lista: Any) -> list[str]:
    if not isinstance(lista, list):
        return []

    normalizada: list[str] = []
    for item in lista:
        texto = str(item or "").strip()
        if texto and texto not in normalizada:
            normalizada.append(texto)

    return normalizada
