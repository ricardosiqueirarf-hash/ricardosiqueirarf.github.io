import os
from flask import Flask, jsonify, request, make_response, send_from_directory
from flask_cors import CORS
from functools import wraps
import jwt
import datetime

# =====================
# CONFIG GLOBAL
# =====================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_TABLE_ESTRUTURAS3D = os.getenv("SUPABASE_TABLE_ESTRUTURAS3D", "estruturas")
TOKEN_DO_ADMIN = os.getenv("tokendoadmin") or os.getenv("TOKENDOADMIN")
JWT_SECRET = os.getenv("JWT_SECRET") or SUPABASE_KEY

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL ou SUPABASE_KEY não definidos")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

# =====================
# APP
# =====================

app = Flask(__name__)
CORS(app)  # aceita requisições de qualquer origem, pode restringir se quiser

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)

# =====================
# HEALTH CHECK
# =====================

@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "ColorGlass API"})

@app.route("/")
def login_cadastro_page():
    return send_from_directory(BASE_DIR, "logincadastro.html")

@app.route("/logincadastro.html")
def login_cadastro_html_page():
    return send_from_directory(BASE_DIR, "logincadastro.html")

# ✅ ADICIONADO: rota para a loja
@app.route("/loja")
def index_loja_page():
    return send_from_directory(BASE_DIR, "index_loja.html")

@app.route("/index_loja.html")
def index_loja_html_page():
    return send_from_directory(BASE_DIR, "index_loja.html")

@app.route("/index.html")
def index_admin_page():
    return send_from_directory(BASE_DIR, "index.html")

@app.route("/portas")
def portas_page():
    return send_from_directory(BASE_DIR, "portas.html")

@app.route("/portas.html")
def portas_html_page():
    return send_from_directory(BASE_DIR, "portas.html")


def exige_nivel_2_ou_3(fn):
    from auth_utils import buscar_usuario_por_token, extrair_token

    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = extrair_token(request)
        usuario = buscar_usuario_por_token(token) if token else None
        nivel = int((usuario or {}).get("level") or 0)
        if nivel not in (2, 3):
            return make_response(jsonify({"error": "Acesso negado"}), 403)
        return fn(*args, **kwargs)

    return wrapper


@app.route("/clientes")
@exige_nivel_2_ou_3
def clientes_page():
    return send_from_directory(ROOT_DIR, "clientes.html")


@app.route("/clientes.html")
@exige_nivel_2_ou_3
def clientes_html_page():
    return send_from_directory(ROOT_DIR, "clientes.html")

# =====================
# REGISTRO DE BLUEPRINTS
# =====================

from api_perfis import perfis_bp
from api_vidros import vidros_bp
from api_insumos import insumos_bp
from api_orcamentos import orcamentos_bp
from api_portas import portas_bp
from api_orc import orc_bp
from api_corte import corte_bp
from api_puxadores import puxadores_bp
from api_estruturas3d import estruturas3d_bp
from api_cadastroelogin import cadastro_login_bp

app.register_blueprint(perfis_bp)
app.register_blueprint(vidros_bp)
app.register_blueprint(insumos_bp)
app.register_blueprint(orcamentos_bp)
app.register_blueprint(portas_bp)
app.register_blueprint(orc_bp)
app.register_blueprint(corte_bp)
app.register_blueprint(puxadores_bp)
app.register_blueprint(estruturas3d_bp)
app.register_blueprint(cadastro_login_bp)

# =====================
# START
# =====================

if __name__ == "__main__":
    app.run(debug=True)








