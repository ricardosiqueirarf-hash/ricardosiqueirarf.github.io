from typing import Any


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


def mask_validation_errors(errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    safe_errors = []

    for error in errors:
        safe_error = dict(error)
        loc = safe_error.get("loc") or []
        loc_parts = {str(part).lower() for part in loc}

        if "input" in safe_error and loc_parts.intersection(SENSITIVE_KEYS):
            safe_error["input"] = "***"
        else:
            safe_error = mask_sensitive_data(safe_error)

        safe_errors.append(safe_error)

    return safe_errors
