import logging
import traceback
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from app.core.auth import audit_event, create_session, get_current_user, revoke_current_session
from app.core.config import get_settings
from app.core.security import enforce_auth_rate_limit
from app.db.supabase_client import get_supabase
from app.models.schemas import CadastroRequest, LoginRequest

router = APIRouter()
logger = logging.getLogger(__name__)

SENSITIVE_KEYS = {"senha", "password", "token", "chave_acesso", "authorization", "x-anodiza-key"}


def mask_sensitive_data(value: Any) -> Any:
    if isinstance(value, dict):
        masked = {}

        for key, item in value.items():
            key_lower = str(key).lower()

            if key_lower in SENSITIVE_KEYS:
                masked[key] = "***"
            else:
                masked[key] = mask_sensitive_data(item)

        return masked

    if isinstance(value, list):
        return [mask_sensitive_data(item) for item in value]

    return value


def sanitize_user(usuario: dict) -> dict:
    return {
        "id": usuario.get("id"),
        "empresa_id": usuario.get("empresa_id"),
        "loja_id": usuario.get("loja_id"),
        "nome": usuario.get("nome"),
        "email": usuario.get("email"),
        "perfil": usuario.get("perfil"),
        "permissoes": usuario.get("permissoes"),
    }


def normalize_rpc_data(data):
    if isinstance(data, dict):
        return data

    if isinstance(data, list) and len(data) == 1 and isinstance(data[0], dict):
        return data[0]

    return None


def run_rpc(name: str, payload: dict):
    safe_payload = mask_sensitive_data(payload)

    logger.info("RPC_START name=%s payload=%s", name, safe_payload)

    try:
        result = get_supabase().rpc(name, {"payload": payload}).execute()
    except Exception as error:
        logger.error(
            "RPC_EXCEPTION name=%s payload=%s error=%s traceback=%s",
            name,
            safe_payload,
            str(error),
            traceback.format_exc(),
        )

        raise HTTPException(
            status_code=400,
            detail=f"Falha ao executar RPC {name}: {str(error)}",
        ) from error

    safe_result = mask_sensitive_data(result.data)
    logger.info("RPC_RESULT name=%s raw_data=%s", name, safe_result)

    data = normalize_rpc_data(result.data)

    if not data:
        logger.error(
            "RPC_EMPTY_RESULT name=%s payload=%s raw_data=%s",
            name,
            safe_payload,
            safe_result,
        )

        raise HTTPException(
            status_code=400,
            detail=f"RPC {name} nao retornou dados validos.",
        )

    logger.info("RPC_SUCCESS name=%s", name)

    return data


def issue_login_response(data: dict, request: Request):
    usuario = data.get("usuario") or {}

    if not usuario.get("id") or not usuario.get("empresa_id"):
        logger.error(
            "LOGIN_RESPONSE_INVALID usuario=%s data=%s",
            mask_sensitive_data(usuario),
            mask_sensitive_data(data),
        )
        raise HTTPException(status_code=400, detail="Usuario nao identificado")

    chave = create_session(usuario, request)
    usuario_seguro = sanitize_user(usuario)

    audit_event(
        usuario_seguro,
        "login",
        "auth",
        usuario.get("id"),
        None,
        {"empresa_slug": data.get("empresa_slug")},
        request,
    )

    return {
        "chave_acesso": chave,
        "empresa_slug": data.get("empresa_slug"),
        "usuario": usuario_seguro,
    }


@router.post("/cadastro")
def cadastro(payload: CadastroRequest, request: Request):
    settings = get_settings()
    payload_dict = payload.model_dump()

    logger.info("CADASTRO_START payload=%s", mask_sensitive_data(payload_dict))

    enforce_auth_rate_limit(
        request,
        "cadastro",
        str(payload.email),
        settings.auth_rate_limit_attempts,
        settings.auth_rate_limit_window_seconds,
    )

    response = issue_login_response(run_rpc("cadastro_empresa", payload_dict), request)

    logger.info(
        "CADASTRO_SUCCESS empresa_slug=%s usuario_id=%s",
        response.get("empresa_slug"),
        response.get("usuario", {}).get("id"),
    )

    return response


@router.post("/login")
def login(payload: LoginRequest, request: Request):
    settings = get_settings()
    payload_dict = payload.model_dump()

    logger.info(
        "LOGIN_START empresa_slug=%s email=%s",
        payload.empresa_slug,
        payload.email,
    )

    enforce_auth_rate_limit(
        request,
        "login",
        f"{payload.empresa_slug}:{payload.email}",
        settings.auth_rate_limit_attempts,
        settings.auth_rate_limit_window_seconds,
    )

    try:
        data = run_rpc("login_empresa", payload_dict)
    except HTTPException as error:
        logger.warning(
            "LOGIN_FAILED empresa_slug=%s email=%s detail=%s",
            payload.empresa_slug,
            payload.email,
            error.detail,
        )
        raise HTTPException(status_code=401, detail="Empresa, e-mail ou senha invalidos") from error

    response = issue_login_response(data, request)

    logger.info(
        "LOGIN_SUCCESS empresa_slug=%s usuario_id=%s",
        response.get("empresa_slug"),
        response.get("usuario", {}).get("id"),
    )

    return response


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return {"ok": True, "usuario": sanitize_user(current_user)}


@router.post("/logout")
def logout(
    request: Request,
    x_anodiza_key: str | None = Header(default=None),
    current_user: dict = Depends(get_current_user),
):
    revoke_current_session(request, x_anodiza_key)

    audit_event(
        current_user,
        "logout",
        "auth",
        current_user.get("id"),
        None,
        None,
        request,
    )

    return {"ok": True}
