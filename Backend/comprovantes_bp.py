import datetime
import os
import requests

from flask import Blueprint, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

# =========================
# CONFIG
# =========================
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://hfhwvzldhgqniqnurync.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "COLOQUE_SUA_ANON_KEY_AQUI")  # use a ANON key do projeto
BUCKET = os.getenv("SUPABASE_BUCKET", "comprovantes")
SIGNED_URL_EXPIRES_SECONDS = int(os.getenv("SIGNED_URL_EXPIRES_SECONDS", "600"))  # 10 minutos

comprovantes_bp = Blueprint("comprovantes_bp", __name__)
CORS(comprovantes_bp, resources={r"/api/*": {"origins": "*"}})

# =========================
# (Opcional) servir HTML localmente pelo Flask
# Coloque upload.html e callback.html numa pasta "public"
# =========================
@comprovantes_bp.route("/upload.html", methods=["GET"])
def serve_upload():
    return send_from_directory("public", "upload.html")

@comprovantes_bp.route("/callback.html", methods=["GET"])
def serve_callback():
    return send_from_directory("public", "callback.html")


# =========================
# HELPERS
# =========================
def _get_bearer_token():
    auth = request.headers.get("Authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    return auth.split(" ", 1)[1].strip()

def _supabase_get_user(access_token: str):
    """
    Valida token e retorna o user (com id).
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
    Upload no storage respeitando RLS/policies (usa token do usuário).
    """
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {access_token}",
        "Content-Type": content_type or "application/octet-stream",
    }
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
    Gera signed URL (ideal se bucket for PRIVATE)
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
# ROUTE: UPLOAD
# =========================
@comprovantes_bp.route("/api/comprovantes/upload", methods=["POST"])
def upload_comprovante():
    """
    Frontend deve enviar:
      Authorization: Bearer <access_token>
    Arquivo:
      multipart/form-data com campo 'arquivo'

    Salva em:
      <user_id>/<timestamp>_<filename>

    Retorna:
      signed_url (ou aviso)
    """
    try:
        access_token = _get_bearer_token()
        if not access_token:
            return jsonify({"error": "Missing/invalid Authorization Bearer token"}), 401

        user, err, status = _supabase_get_user(access_token)
        if not user:
            return jsonify({"error": "Invalid token", "details": err}), status

        user_id = user.get("id")
        if not user_id:
            return jsonify({"error": "Could not resolve user id"}), 401

        arquivo = request.files.get("arquivo")
        if not arquivo:
            return jsonify({"error": "Arquivo não enviado (campo 'arquivo')"}), 400

        original_name = arquivo.filename or "comprovante"
        nome_seguro = secure_filename(original_name) or "comprovante"

        timestamp = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S")
        nome_arquivo = f"{timestamp}_{nome_seguro}"

        # OBRIGATÓRIO para policy: primeira pasta == user_id
        path = f"{user_id}/{nome_arquivo}"

        file_bytes = arquivo.read()
        content_type = arquivo.mimetype or "application/octet-stream"

        r_up = _supabase_upload_object(
            access_token=access_token,
            path=path,
            file_bytes=file_bytes,
            content_type=content_type,
            upsert=False,
        )

        if not r_up.ok:
            return jsonify({
                "error": "Upload failed",
                "status_code": r_up.status_code,
                "details": r_up.text,
                "hint": "Se der 403, sua policy/path não bateu. O path deve começar com user_id/..."
            }), r_up.status_code

        r_sign = _supabase_signed_url(access_token, path, SIGNED_URL_EXPIRES_SECONDS)
        if not r_sign.ok:
            return jsonify({
                "status": "ok",
                "arquivo": nome_arquivo,
                "path": path,
                "warning": "Uploaded but failed to generate signed URL",
                "sign_error": r_sign.text
            }), 200

        signed = r_sign.json()
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
