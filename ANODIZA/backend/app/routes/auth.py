from fastapi import APIRouter, Header, HTTPException

from app.db.supabase_client import get_supabase

router = APIRouter()


def registrar_acesso(data: dict):
    usuario = data.get("usuario") or {}
    usuario_id = usuario.get("id")
    empresa_id = usuario.get("empresa_id")
    if not usuario_id or not empresa_id:
        return data
    try:
        controle = get_supabase().rpc("gerar_controle", {"v_pessoa": usuario_id, "v_empresa": empresa_id}).execute()
        data["chave_acesso"] = controle.data
    except Exception:
        pass
    return data


def run_rpc(name: str, payload: dict):
    try:
        result = get_supabase().rpc(name, {"payload": payload}).execute()
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Erro na API: {error}") from error
    if not result.data:
        raise HTTPException(status_code=400, detail="Operacao nao realizada")
    return result.data


@router.post("/cadastro")
def cadastro(payload: dict):
    return registrar_acesso(run_rpc("cadastro_empresa", payload))


@router.post("/login")
def login(payload: dict):
    return registrar_acesso(run_rpc("login_empresa", payload))


@router.get("/me")
def me(x_anodiza_key: str | None = Header(default=None)):
    if not x_anodiza_key:
        raise HTTPException(status_code=401, detail="Informe a chave")
    try:
        pessoa = get_supabase().rpc("obter_pessoa_controle", {"v_id": x_anodiza_key}).execute()
    except Exception as error:
        raise HTTPException(status_code=401, detail=f"Controle invalido: {error}") from error
    return {"ok": True, "usuario": pessoa.data}
