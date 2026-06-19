from fastapi import APIRouter, Depends

from app.core.auth import require_permission

router = APIRouter()


@router.get("/index")
def index_loja(current_user: dict = Depends(require_permission("painel"))):
    return {
        "titulo": "Painel da Loja",
        "cards": [
            {"label": "Orcamentos", "valor": 0},
            {"label": "Aprovados", "valor": 0},
            {"label": "Em producao", "valor": 0},
        ],
    }
