from typing import Any

from app.repositories.common import supabase_client

PROVIDER = "conta_azul"


def buscar_integracao(empresa_id: str) -> dict[str, Any] | None:
    result = (
        supabase_client()
        .table("empresa_api_integracoes")
        .select("*")
        .eq("empresa_id", empresa_id)
        .eq("provider", PROVIDER)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def salvar_integracao(
    empresa_id: str,
    access_token: str | None = None,
    refresh_token: str | None = None,
    status: str = "conectada",
    settings: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
):
    existente = buscar_integracao(empresa_id)
    payload: dict[str, Any] = {
        "empresa_id": empresa_id,
        "provider": PROVIDER,
        "status": status,
        "settings": settings or {},
        "metadata": metadata or {},
    }
    if access_token:
        # MVP: campo preparado para token criptografado.
        # No fluxo OAuth definitivo, gravar aqui o token ja criptografado/decriptavel pela camada segura.
        payload["access_token_encrypted"] = access_token
    if refresh_token:
        payload["refresh_token_encrypted"] = refresh_token

    if existente:
        result = (
            supabase_client()
            .table("empresa_api_integracoes")
            .update(payload)
            .eq("empresa_id", empresa_id)
            .eq("provider", PROVIDER)
            .execute()
        )
    else:
        result = supabase_client().table("empresa_api_integracoes").insert(payload).execute()

    return result.data[0] if result.data else None


def access_token_da_integracao(integracao: dict[str, Any] | None) -> str:
    if not integracao:
        return ""
    return str(integracao.get("access_token_encrypted") or "")


def settings_da_integracao(integracao: dict[str, Any] | None) -> dict[str, Any]:
    if not integracao:
        return {}
    settings = integracao.get("settings") or {}
    return settings if isinstance(settings, dict) else {}


def buscar_mapping(
    empresa_id: str,
    entity_type: str,
    entity_id: str,
    external_entity_type: str,
) -> dict[str, Any] | None:
    result = (
        supabase_client()
        .table("external_api_mappings")
        .select("*")
        .eq("empresa_id", empresa_id)
        .eq("provider", PROVIDER)
        .eq("entity_type", entity_type)
        .eq("entity_id", entity_id)
        .eq("external_entity_type", external_entity_type)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def salvar_mapping(
    empresa_id: str,
    entity_type: str,
    entity_id: str,
    external_entity_type: str,
    external_id: str,
    external_reference: str | None = None,
    payload_snapshot: dict[str, Any] | None = None,
):
    existente = buscar_mapping(empresa_id, entity_type, entity_id, external_entity_type)
    payload = {
        "empresa_id": empresa_id,
        "provider": PROVIDER,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "external_entity_type": external_entity_type,
        "external_id": external_id,
        "external_reference": external_reference,
        "payload_snapshot": payload_snapshot or {},
    }
    if existente:
        result = (
            supabase_client()
            .table("external_api_mappings")
            .update(payload)
            .eq("id", existente["id"])
            .execute()
        )
    else:
        result = supabase_client().table("external_api_mappings").insert(payload).execute()
    return result.data[0] if result.data else None


def registrar_log(
    empresa_id: str,
    action: str,
    status: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    external_entity_type: str | None = None,
    external_id: str | None = None,
    request_payload: dict[str, Any] | None = None,
    response_payload: dict[str, Any] | None = None,
    error_message: str | None = None,
):
    payload = {
        "empresa_id": empresa_id,
        "provider": PROVIDER,
        "action": action,
        "status": status,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "external_entity_type": external_entity_type,
        "external_id": external_id,
        "request_payload": request_payload or {},
        "response_payload": response_payload or {},
        "error_message": error_message,
    }
    result = supabase_client().table("external_api_sync_logs").insert(payload).execute()
    return result.data[0] if result.data else None
