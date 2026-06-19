from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = Field(min_length=1)
    supabase_backend_key: str = Field(min_length=1)
    signing_key: str = Field(min_length=32)
    session_minutes: int = 720
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    auth_rate_limit_attempts: int = 10
    auth_rate_limit_window_seconds: int = 300


def get_settings() -> Settings:
    return Settings()
