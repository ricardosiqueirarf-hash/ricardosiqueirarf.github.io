from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routes import auth, clientes, colaboradores, loja, pedidos, tenants

settings = get_settings()
origins = [origin.strip().rstrip("/") for origin in settings.cors_origins.split(",") if origin.strip()]
origins = sorted(set(origins))

app = FastAPI(title="ANODIZA API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tenants.router, prefix="/api/tenants", tags=["tenants"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(clientes.router, prefix="/api/loja", tags=["loja-clientes"])
app.include_router(colaboradores.router, prefix="/api/loja", tags=["loja-acessos"])
app.include_router(pedidos.router, prefix="/api/loja", tags=["loja-orcamentos"])
app.include_router(loja.router, prefix="/api/loja", tags=["loja-compat"])


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "ANODIZA", "cors_origins": origins}
