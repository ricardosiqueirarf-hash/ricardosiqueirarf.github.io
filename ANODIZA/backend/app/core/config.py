from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_backend_key: str = ""
    signing_key: str = "change-me"
    session_minutes: int = 720
    cors_origins: str = "http://localhost:3000"


def get_settings() -> Settings:
    return Settings()
