import json
import logging
import traceback
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import get_settings
from app.core.logging_utils import mask_sensitive_data, mask_validation_errors
from app.routes import auth, clientes, colaboradores, loja, materiais, pedidos, produtos, produtos_globais, tags, tenants


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

logger = logging.getLogger("anodiza")

settings = get_settings()
origins = [origin.strip().rstrip("/") for origin in settings.cors_origins.split(",") if origin.strip()]
origins.extend([
    "https://anodiza-frontend.onrender.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
])
origins = sorted(set(origins))

app = FastAPI(title="ANODIZA API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def cors_error_headers(request: Request) -> dict[str, str]:
    origin = request.headers.get("origin") or ""
    permitido = origin if origin in origins or origin.endswith(".onrender.com") else "https://anodiza-frontend.onrender.com"
    return {
        "Access-Control-Allow-Origin": permitido,
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers") or "*",
        "Vary": "Origin",
    }


async def read_safe_body(request: Request) -> Any:
    try:
        raw_body = await request.body()

        if not raw_body:
            return None

        try:
            parsed = json.loads(raw_body.decode("utf-8"))
            return mask_sensitive_data(parsed)
        except Exception:
            return raw_body.decode("utf-8", errors="replace")[:2000]

    except Exception as error:
        return f"Nao foi possivel ler body: {error}"


@app.middleware("http")
async def request_log_middleware(request: Request, call_next):
    logger.info(
        "REQUEST_START method=%s path=%s client=%s",
        request.method,
        request.url.path,
        request.client.host if request.client else None,
    )

    try:
        response = await call_next(request)
    except Exception as error:
        logger.error(
            "REQUEST_EXCEPTION method=%s path=%s error=%s traceback=%s",
            request.method,
            request.url.path,
            str(error),
            traceback.format_exc(),
        )
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Erro interno no servidor.",
                "message": "Falha inesperada no backend. Veja os logs do Render.",
            },
            headers=cors_error_headers(request),
        )

    logger.info(
        "REQUEST_END method=%s path=%s status=%s",
        request.method,
        request.url.path,
        response.status_code,
    )

    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    safe_errors = mask_validation_errors(exc.errors())
    safe_body = mask_sensitive_data(exc.body)

    logger.error(
        "VALIDATION_ERROR method=%s path=%s errors=%s body=%s",
        request.method,
        request.url.path,
        safe_errors,
        safe_body,
    )

    return JSONResponse(
        status_code=422,
        content={
            "detail": safe_errors,
            "message": "Erro de validacao no payload enviado para a API.",
        },
        headers=cors_error_headers(request),
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    safe_body = await read_safe_body(request)

    logger.warning(
        "HTTP_ERROR method=%s path=%s status=%s detail=%s body=%s",
        request.method,
        request.url.path,
        exc.status_code,
        exc.detail,
        safe_body,
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={**cors_error_headers(request), **(getattr(exc, "headers", None) or {})},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    safe_body = await read_safe_body(request)

    logger.error(
        "UNHANDLED_ERROR method=%s path=%s error=%s body=%s traceback=%s",
        request.method,
        request.url.path,
        str(exc),
        safe_body,
        traceback.format_exc(),
    )

    return JSONResponse(
        status_code=500,
        content={
            "detail": "Erro interno no servidor.",
            "message": "Falha inesperada no backend. Veja os logs do Render.",
        },
        headers=cors_error_headers(request),
    )


app.include_router(tenants.router, prefix="/api/tenants", tags=["tenants"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(clientes.router, prefix="/api/loja", tags=["loja-clientes"])
app.include_router(colaboradores.router, prefix="/api/loja", tags=["loja-acessos"])
app.include_router(pedidos.router, prefix="/api/loja", tags=["loja-orcamentos"])
app.include_router(materiais.router, prefix="/api/loja", tags=["loja-materiais"])
app.include_router(tags.router, prefix="/api/loja", tags=["loja-tags"])
app.include_router(produtos.router, prefix="/api/loja", tags=["loja-produtos"])
app.include_router(produtos_globais.router, prefix="/api/loja", tags=["loja-produtos-globais"])
app.include_router(loja.router, prefix="/api/loja", tags=["loja-painel"])


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "ANODIZA", "cors_origins": origins}
