from time import monotonic

from fastapi import HTTPException, Request


_RATE_LIMIT_BUCKETS: dict[str, list[float]] = {}


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for") or ""
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


def enforce_rate_limit(key: str, attempts: int, window_seconds: int) -> None:
    now = monotonic()
    window_start = now - window_seconds
    recent_attempts = [timestamp for timestamp in _RATE_LIMIT_BUCKETS.get(key, []) if timestamp >= window_start]
    if len(recent_attempts) >= attempts:
        _RATE_LIMIT_BUCKETS[key] = recent_attempts
        raise HTTPException(status_code=429, detail="Muitas tentativas. Tente novamente em alguns minutos")
    recent_attempts.append(now)
    _RATE_LIMIT_BUCKETS[key] = recent_attempts


def enforce_auth_rate_limit(request: Request, action: str, identifier: str, attempts: int, window_seconds: int) -> None:
    normalized_identifier = identifier.strip().lower() or "anonimo"
    ip = client_ip(request) or "sem-ip"
    enforce_rate_limit(f"auth:{action}:ip:{ip}", attempts, window_seconds)
    enforce_rate_limit(f"auth:{action}:identificador:{normalized_identifier}", attempts, window_seconds)
