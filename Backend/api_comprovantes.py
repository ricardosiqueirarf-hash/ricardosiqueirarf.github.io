import os
import datetime
import requests
from flask import Blueprint, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL ou SUPABASE_KEY não configurados")

comprovantes_bp = Blueprint("comprovantes_bp", __name__)
CORS(comprovantes_bp, resources={r"/api/*": {"origins": "*"}})

@comprovantes_bp.route("/api/comprovantes/upload", methods=["POST"])
def upload_comprovante():
    arquivo = request.files.get("arquivo")
    if not arquivo:
        return jsonify({"error": "Arquivo não enviado"}), 400

    nome_seguro = secure_filename(arquivo.filename or "comprovante")
    timestamp = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S")
    nome_arquivo = f"{timestamp}_{nome_seguro}"

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": arquivo.mimetype or "application/octet-stream"
    }

    try:
        response = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/comprovantes/{nome_arquivo}",
            headers=headers,
            params={"upsert": "true"},
            data=arquivo.read()
        )
        response.raise_for_status()

        public_url = (
            f"{SUPABASE_URL}/storage/v1/object/public/comprovantes/{nome_arquivo}"
        )
        return jsonify({"status": "ok", "arquivo": nome_arquivo, "url": public_url})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

