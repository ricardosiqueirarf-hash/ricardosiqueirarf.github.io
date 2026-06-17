from fastapi import APIRouter

router = APIRouter()


@router.get("/index")
def index_loja():
    return {
        "titulo": "Painel da Loja",
        "cards": [
            {"label": "Orcamentos", "valor": 0},
            {"label": "Aprovados", "valor": 0},
            {"label": "Em producao", "valor": 0},
        ],
    }
