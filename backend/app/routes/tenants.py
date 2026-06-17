from fastapi import APIRouter, HTTPException, Query

from app.db.supabase_client import get_supabase

router = APIRouter()


@router.get("/resolve")
def resolve_tenant(host: str = Query(default=""), slug: str = Query(default="")):
    supabase = get_supabase()

    if slug:
        result = supabase.table("empresas").select("*").eq("slug", slug).limit(1).execute()
    elif host:
        result = supabase.table("empresas").select("*").eq("dominio", host).limit(1).execute()
    else:
        raise HTTPException(status_code=400, detail="Informe host ou slug")

    if not result.data:
        raise HTTPException(status_code=404, detail="Empresa nao encontrada")

    empresa = result.data[0]
    return {
        "id": empresa["id"],
        "nome": empresa["nome"],
        "slug": empresa["slug"],
        "dominio": empresa.get("dominio"),
        "logo_url": empresa.get("logo_url"),
        "cor_primaria": empresa.get("cor_primaria"),
        "cor_secundaria": empresa.get("cor_secundaria"),
    }
