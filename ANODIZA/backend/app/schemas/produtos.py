from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


TipoCampo = Literal["numero", "texto", "material", "booleano"]
CategoriaMaterial = Literal["perfil", "vidro", "puxador", "insumo", "trilho", "componente", "outro"]
OrigemComponente = Literal["campo_material", "insumos_do_material", "tag_regras", "valor_adicional"]
BaseQuantidade = Literal["unidade", "quantidade", "area", "perimetro", "largura_m", "altura_m", "campo_numero", "campo_mm_para_m"]


class ProdutoConfiguravelCreate(BaseModel):
    empresa_slug: str = ""
    nome: str = Field(min_length=1)
    descricao: str = ""
    ativo: bool = True
    configuracao: dict[str, Any] = Field(default_factory=dict)

    @field_validator("empresa_slug", "nome", "descricao", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def normalizar_configuracao(self):
        self.configuracao = normalizar_configuracao_produto(self.configuracao)
        return self


class ProdutoConfiguravelUpdate(ProdutoConfiguravelCreate):
    id: str = Field(min_length=1)

    @field_validator("id", mode="before")
    @classmethod
    def strip_id(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class ProdutoConfiguravelDelete(BaseModel):
    empresa_slug: str = ""
    id: str = Field(min_length=1)

    @field_validator("empresa_slug", "id", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class ProdutoConfiguravelCalculo(BaseModel):
    empresa_slug: str = ""
    produto_id: str = Field(min_length=1)
    quantidade: float = Field(default=1, gt=0)
    valores: dict[str, Any] = Field(default_factory=dict)

    @field_validator("empresa_slug", "produto_id", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class ProdutoConfiguravelOrcamentoCreate(ProdutoConfiguravelCalculo):
    orcamento_id: str = Field(min_length=1)

    @field_validator("orcamento_id", mode="before")
    @classmethod
    def strip_orcamento(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


def normalizar_configuracao_produto(configuracao: dict[str, Any]) -> dict[str, Any]:
    config = dict(configuracao or {})
    campos = []
    componentes = []

    for campo in config.get("campos") or []:
        if not isinstance(campo, dict):
            continue
        chave = _slug(str(campo.get("chave") or campo.get("nome") or ""))
        rotulo = str(campo.get("rotulo") or campo.get("nome") or chave).strip()
        tipo = str(campo.get("tipo") or "texto").strip()
        if not chave or tipo not in {"numero", "texto", "material", "booleano"}:
            continue
        item = {
            "chave": chave,
            "rotulo": rotulo or chave,
            "tipo": tipo,
            "obrigatorio": bool(campo.get("obrigatorio", False)),
            "padrao": campo.get("padrao"),
        }
        if tipo == "material":
            categoria = str(campo.get("categoria") or "outro").strip()
            item["categoria"] = categoria if categoria in {"perfil", "vidro", "puxador", "insumo", "trilho", "componente", "outro"} else "outro"
            item["permitir_sem_item"] = bool(campo.get("permitir_sem_item", False))
        campos.append(item)

    for componente in config.get("componentes") or []:
        if not isinstance(componente, dict):
            continue
        nome = str(componente.get("nome") or "").strip()
        origem = str(componente.get("origem") or "campo_material").strip()
        base = str(componente.get("base_quantidade") or "unidade").strip()
        if origem not in {"campo_material", "insumos_do_material", "tag_regras", "valor_adicional"}:
            continue
        if base not in {"unidade", "quantidade", "area", "perimetro", "largura_m", "altura_m", "campo_numero", "campo_mm_para_m"}:
            base = "unidade"
        componentes.append({
            "nome": nome or origem,
            "origem": origem,
            "campo_material": str(componente.get("campo_material") or "").strip(),
            "campo_origem": str(componente.get("campo_origem") or "").strip(),
            "base_quantidade": base,
            "multiplicador": float(componente.get("multiplicador") or 1),
        })

    config["campos"] = campos
    config["componentes"] = componentes
    config["medidas"] = {
        "largura": str((config.get("medidas") or {}).get("largura") or "largura").strip(),
        "altura": str((config.get("medidas") or {}).get("altura") or "altura").strip(),
    }
    return config


def _slug(texto: str) -> str:
    import re
    import unicodedata

    base = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode("ascii")
    base = re.sub(r"[^a-zA-Z0-9]+", "_", base).strip("_").lower()
    return base
