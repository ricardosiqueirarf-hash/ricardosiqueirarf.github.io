import datetime
import os

import requests
from flask import Blueprint, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename

# =========================
# CONFIG
# =========================
SUPABASE_URL = "https://hfhwvzldhgqniqnurync.supabase.co"

# Use a ANON key aqui (segura pra ficar no backend e também no front).
# NÃO use service_role no front jamais.
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "COLOQUE_SUA_ANON_KEY_AQUI")

BUCKET = "comprovantes"
SIGNED_URL_EXPIRES_SECONDS = 60 * 10  # 10 minutos

comprovantes_bp = Blueprint("comprovantes_bp", __name__)
CORS(comprovantes_bp, resources={r"/api/*": {"origins": "*"}})


# =========================
# HELPERS
# =========================
def _get_bearer_token():
    """
    Espera header:
      Authorization: Bearer <access_token>
    """
    auth = request.headers.get("Authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    return auth.split(" ", 1)[1].strip()


def _supabase_get_user(access_token: str):
    """
    Valida token e retorna user (inclui user.id).
    Endpoint oficial: GET /auth/v1/user
    """
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {access_token}",
    }
    r = requests.get(f"{SUPABASE_URL}/auth/v1/user", headers=headers, timeout=20)
    if not r.ok:
        return None, r.text, r.status_code
    return r.json(), None, 200


def _supabase_upload_object(access_token: str, path: str, file_bytes: bytes, content_type: str, upsert: bool = False):
    """
    Faz upload no Storage respeitando RLS (usa o token do usuário).
    """
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {access_token}",
        "Content-Type": content_type or "application/octet-stream",
    }

    # Observação: a URL do object é /storage/v1/object/<bucket>/<path>
    # path pode conter subpastas (ex: userId/arquivo.pdf)
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"

    r = requests.post(
        url,
        headers=headers,
        params={"upsert": "true" if upsert else "false"},
        data=file_bytes,
        timeout=60,
    )
    return r


def _supabase_signed_url(access_token: str, path: str, expires_in: int):
    """
    Gera URL assinada (ideal para bucket PRIVATE).
    Endpoint: POST /storage/v1/object/sign/<bucket>/<path>
    Body: {"expiresIn": seconds}
    """
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    url = f"{SUPABASE_URL}/storage/v1/object/sign/{BUCKET}/{path}"
    r = requests.post(url, headers=headers, json={"expiresIn": int(expires_in)}, timeout=20)
    return r


# =========================
# ROUTE
# =========================
@comprovantes_bp.route("/api/comprovantes/upload", methods=["POST"])
def upload_comprovante():
    """
    Upload de comprovante para Supabase Storage.

    Requisitos:
    - Frontend deve enviar:
        Authorization: Bearer <access_token>
      (token do supabase.auth do usuário logado)
    - O arquivo deve vir em multipart:
        arquivo=<file>

    Armazenamento:
      comprovantes/<userId>/<timestamp>_<filename>
    """
    try:
        # 1) Token do usuário
        access_token = _get_bearer_token()
        if not access_token:
            return jsonify({"error": "Missing/invalid Authorization Bearer token"}), 401

        # 2) Valida token e pega user.id
        user, err, status = _supabase_get_user(access_token)
        if not user:
            return jsonify({"error": "Invalid token", "details": err}), status

        user_id = user.get("id")
        if not user_id:
            return jsonify({"error": "Could not resolve user id"}), 401

        # 3) Arquivo
        arquivo = request.files.get("arquivo")
        if not arquivo:
            return jsonify({"error": "Arquivo não enviado (campo 'arquivo')"}), 400

        # Segurança básica
        original_name = arquivo.filename or "comprovante"
        nome_seguro = secure_filename(original_name) or "comprovante"

        timestamp = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S")
        nome_arquivo = f"{timestamp}_{nome_seguro}"

        # 4) Path OBRIGATÓRIO pra bater com policy: <user_id>/...
        path = f"{user_id}/{nome_arquivo}"

        # 5) Upload usando o token do usuário (RLS/policy manda)
        file_bytes = arquivo.read()
        content_type = arquivo.mimetype or "application/octet-stream"

        r_up = _supabase_upload_object(
            access_token=access_token,
            path=path,
            file_bytes=file_bytes,
            content_type=content_type,
            upsert=False,  # recomendo false pra não sobrescrever sem querer
        )

        if not r_up.ok:
            # Normalmente aqui vem 403 se policy/path estiver errado
            return jsonify({
                "error": "Upload failed",
                "status_code": r_up.status_code,
                "details": r_up.text
            }), r_up.status_code

        # 6) Retorna signed URL (ideal pra bucket private)
        r_sign = _supabase_signed_url(
            access_token=access_token,
            path=path,
            expires_in=SIGNED_URL_EXPIRES_SECONDS,
        )

        if not r_sign.ok:
            # Upload funcionou, mas falhou assinar. Ainda retornamos path.
            return jsonify({
                "status": "ok",
                "arquivo": nome_arquivo,
                "path": path,
                "warning": "Uploaded but failed to generate signed URL",
                "sign_error": r_sign.text
            }), 200

        signed = r_sign.json()
        # resposta costuma vir como {"signedURL": "..."} ou {"signedUrl": "..."} dependendo
        signed_url = signed.get("signedURL") or signed.get("signedUrl") or signed.get("signed_url")

        return jsonify({
            "status": "ok",
            "arquivo": nome_arquivo,
            "path": path,
            "signed_url": signed_url,
            "expires_in": SIGNED_URL_EXPIRES_SECONDS,
        }), 200

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500



