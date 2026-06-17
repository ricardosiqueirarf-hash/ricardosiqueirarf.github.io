from pydantic import BaseModel, EmailStr, Field


class CadastroRequest(BaseModel):
    empresa_nome: str = Field(min_length=2)
    loja_nome: str = Field(min_length=2)
    nome: str = Field(min_length=2)
    email: EmailStr
    senha: str = Field(min_length=6)


class LoginRequest(BaseModel):
    empresa_slug: str = Field(min_length=2)
    email: EmailStr
    senha: str = Field(min_length=6)


class UsuarioResponse(BaseModel):
    id: str
    empresa_id: str
    loja_id: str | None = None
    nome: str
    email: EmailStr
    perfil: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioResponse
    empresa_slug: str


class TenantResponse(BaseModel):
    id: str
    nome: str
    slug: str
    dominio: str | None = None
    logo_url: str | None = None
    cor_primaria: str
    cor_secundaria: str
