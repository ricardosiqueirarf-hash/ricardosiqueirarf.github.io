from pydantic import BaseModel


class ClienteCreate(BaseModel):
    empresa_slug: str = ""
    nome: str
    documento: str = ""
    email: str = ""
    telefone: str = ""


class ClienteUpdate(ClienteCreate):
    id: str
