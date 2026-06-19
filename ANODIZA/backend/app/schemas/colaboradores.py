from pydantic import BaseModel, EmailStr, Field, field_validator


class ColaboradorCreate(BaseModel):
    empresa_slug: str = ""
    nome: str = Field(min_length=2)
    email: EmailStr
    perfil: str = "vendedor"
    senha: str = Field(min_length=6)

    @field_validator("empresa_slug", "nome", "email", "perfil", "senha", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class ColaboradorPermissoesUpdate(BaseModel):
    empresa_slug: str = ""
    id: str
    permissoes: dict
