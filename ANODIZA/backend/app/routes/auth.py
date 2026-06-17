from fastapi import APIRouter

from app.db.supabase_client import get_supabase

router = APIRouter()


@router.post("/cadastro")
def cadastro(payload: dict):
    supabase = get_supabase()
    empresa = supabase.table("empresas").insert({"nome": payload.get("empresa_nome"), "slug": "teste"}).execute().data[0]
    return {"ok": True, "empresa": empresa}


@router.post("/login")
def login(payload: dict):
    return {"ok": True}


@router.get("/me")
def me():
    return {"ok": True}
