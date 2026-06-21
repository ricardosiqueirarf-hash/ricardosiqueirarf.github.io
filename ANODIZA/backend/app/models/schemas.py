from pydantic import BaseModel, EmailStr, Field, field_validator


class CadastroRequest(BaseModel):
    empresa_nome: str = Field(min_length=2)
    nome: str = Field(min_length=2)
    email: EmailStr
    senha: str = Field(min_length=8)

    @field_validator("empresa_nome", "nome", "email", "senha", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class LoginRequest(BaseModel):
    empresa_slug: str = Field(min_length=2)
    email: EmailStr
    senha: str = Field(min_length=6)

    @field_validator("empresa_slug", "email", "senha", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @field_validator("empresa_slug")
    @classmethod
    def normalize_empresa_slug(cls, value: str) -> str:
        return value.lower()

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class UsuarioResponse(BaseModel):
    id: str
    empresa_id: str
    loja_id: str | None = None
    nome: str
    email: EmailStr
    perfil: str


class AuthResponse(BaseModel):
    chave_acesso: str
    empresa_slug: str
    usuario: UsuarioResponse


class TenantResponse(BaseModel):
    id: str
    nome: str
    slug: str
    dominio: str | None = None
    logo_url: str | None = None
    cor_primaria: str
    cor_secundaria: str
