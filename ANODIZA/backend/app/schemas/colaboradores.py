from pydantic import BaseModel


class ColaboradorCreate(BaseModel):
    empresa_slug: str = ""
    nome: str
    email: str
    perfil: str = "vendedor"
    senha: str = ""


class ColaboradorPermissoesUpdate(BaseModel):
    empresa_slug: str = ""
    id: str
    permissoes: dict
