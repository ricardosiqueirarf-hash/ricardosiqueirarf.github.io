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

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# =====================
# HEALTH CHECK
# =====================

@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "ColorGlass API"})


@app.route("/logincadastro")
@app.route("/logincadastro.html")
def login_cadastro_page():
    return send_from_directory(BASE_DIR, "logincadastro.html")

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


