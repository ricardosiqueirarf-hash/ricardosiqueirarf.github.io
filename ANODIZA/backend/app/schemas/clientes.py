from pydantic import BaseModel, EmailStr, Field, TypeAdapter, field_validator


EMAIL_ADAPTER = TypeAdapter(EmailStr)


class ClienteCreate(BaseModel):
    empresa_slug: str = ""
    nome: str = Field(min_length=1)
    documento: str = ""
    email: str = ""
    telefone: str = ""

    @field_validator("empresa_slug", "nome", "documento", "email", "telefone", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def normalize_optional_email(cls, value: str) -> str:
        if not value:
            return ""
        return str(EMAIL_ADAPTER.validate_python(value)).lower()


class ClienteUpdate(ClienteCreate):
    id: str = Field(min_length=1)

    @field_validator("id", mode="before")
    @classmethod
    def strip_id(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value
