from pydantic import BaseModel, EmailStr


class UsuarioResponse(BaseModel):
    id: str
    empresa_id: str
    loja_id: str | None = None
    nome: str
    email: EmailStr
    perfil: str


class TenantResponse(BaseModel):
    id: str
    nome: str
    slug: str
    dominio: str | None = None
    logo_url: str | None = None
    cor_primaria: str
    cor_secundaria: str
