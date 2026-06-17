from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routes import auth, loja, tenants

settings = get_settings()

app = FastAPI(title="ANODIZA API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tenants.router, prefix="/api/tenants", tags=["tenants"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(loja.router, prefix="/api/loja", tags=["loja"])


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "ANODIZA"}
