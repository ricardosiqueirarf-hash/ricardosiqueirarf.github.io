from fastapi import APIRouter

router = APIRouter()


@router.post("/cadastro")
def cadastro(payload: dict):
    return {
        "ok": True,
        "message": "Rota de cadastro criada.",
        "payload_recebido": {k: v for k, v in payload.items() if k != "senha"},
    }


@router.post("/login")
def login(payload: dict):
    return {
        "ok": True,
        "message": "Rota de login criada.",
        "empresa_slug": payload.get("empresa_slug"),
        "email": payload.get("email"),
    }


@router.get("/me")
def me():
    return {"ok": True, "message": "Sessao do usuario sera ligada aqui."}
