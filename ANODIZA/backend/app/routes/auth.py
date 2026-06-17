from fastapi import APIRouter, HTTPException

from app.db.supabase_client import get_supabase

router = APIRouter()


@router.post("/cadastro")
def cadastro(payload: dict):
    result = get_supabase().rpc("cadastro_empresa", payload).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Cadastro nao realizado")
    return result.data


@router.post("/login")
def login(payload: dict):
    result = get_supabase().rpc("login_empresa", payload).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Dados invalidos")
    return result.data


@router.get("/me")
def me():
    return {"ok": True}
