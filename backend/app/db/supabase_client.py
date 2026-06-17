from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache
def get_supabase() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_backend_key:
        raise RuntimeError("Configurar supabase_url e supabase_backend_key no ambiente")
    return create_client(settings.supabase_url, settings.supabase_backend_key)
