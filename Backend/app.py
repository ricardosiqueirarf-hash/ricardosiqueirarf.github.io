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
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)

# =====================
# HEALTH CHECK
# =====================

@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "ColorGlass API"})

# =====================
# ROTAS PUBLICAS
# =====================

@app.route("/")
def home_page():
    return send_from_directory(BASE_DIR, "inicio.html")

@app.route("/inicio.html")
def inicio_html_page():
    return send_from_directory(BASE_DIR, "inicio.html")

@app.route("/login.html")
def login_html_page():
    return send_from_directory(BASE_DIR, "login.html")

@app.route("/login")
def login_page():
    return send_from_directory(BASE_DIR, "login.html")

@app.route("/logincadastro.html")
def login_cadastro_html_page():
    return send_from_directory(BASE_DIR, "login.html")

@app.route("/cadastro.html")
def cadastro_html_page():
    return send_from_directory(BASE_DIR, "cadastro.html")

@app.route("/cadastro")
def cadastro_page():
    return send_from_directory(BASE_DIR, "cadastro.html")

# =====================
# DECORATOR
# =====================

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

# =====================
# ROTAS PROTEGIDAS
# =====================

@app.route("/loja")
@exige_nivel_2_ou_3
def index_loja_page():
    return send_from_directory(BASE_DIR, "index_loja.html")

@app.route("/index_loja.html")
@exige_nivel_2_ou_3
def index_loja_html_page():
    return send_from_directory(BASE_DIR, "index_loja.html")

@app.route("/index.html")
@exige_nivel_2_ou_3
def index_admin_page():
    return send_from_directory(BASE_DIR, "index.html")

@app.route("/portas")
@exige_nivel_2_ou_3
def portas_page():
    return send_from_directory(BASE_DIR, "portas.html")

@app.route("/portas.html")
@exige_nivel_2_ou_3
def portas_html_page():
    return send_from_directory(BASE_DIR, "portas.html")

@app.route("/catalogo3d")
@exige_nivel_2_ou_3
def catalogo3d_page():
    return send_from_directory(BASE_DIR, "catalogo3d.html")

@app.route("/catalogo3d.html")
@exige_nivel_2_ou_3
def catalogo3d_html_page():
    return send_from_directory(BASE_DIR, "catalogo3d.html")

@app.route("/aprovacao")
@exige_nivel_2_ou_3
def aprovacao_page():
    return send_from_directory(BASE_DIR, "aprovacao.html")

@app.route("/aprovacao.html")
@exige_nivel_2_ou_3
def aprovacao_html_page():
    return send_from_directory(BASE_DIR, "aprovacao.html")

@app.route("/tags")
@exige_nivel_2_ou_3
def tags_page():
    return send_from_directory(BASE_DIR, "tags.html")

@app.route("/tags.html")
@exige_nivel_2_ou_3
def tags_html_page():
    return send_from_directory(BASE_DIR, "tags.html")

@app.route("/financeiro")
@exige_nivel_2_ou_3
def financeiro_page():
    return send_from_directory(BASE_DIR, "financeiro.html")

@app.route("/financeiro.html")
@exige_nivel_2_ou_3
def financeiro_html_page():
    return send_from_directory(BASE_DIR, "financeiro.html")

@app.route("/comprovantes")
@exige_nivel_2_ou_3
def comprovantes_page():
    return send_from_directory(BASE_DIR, "comprovantes.html")

@app.route("/comprovantes.html")
@exige_nivel_2_ou_3
def comprovantes_html_page():
    return send_from_directory(BASE_DIR, "comprovantes.html")

@app.route("/estruturastemp")
@exige_nivel_2_ou_3
def estruturastemp_page():
    return send_from_directory(BASE_DIR, "estruturastemp.html")

@app.route("/estruturastemp.html")
@exige_nivel_2_ou_3
def estruturastemp_html_page():
    return send_from_directory(BASE_DIR, "estruturastemp.html")

@app.route("/callback")
@exige_nivel_2_ou_3
def callback_page():
    return send_from_directory(BASE_DIR, "callback.html")

@app.route("/callback.html")
@exige_nivel_2_ou_3
def callback_html_page():
    return send_from_directory(BASE_DIR, "callback.html")

@app.route("/imagefinder")
@exige_nivel_2_ou_3
def imagefinder_page():
    return send_from_directory(BASE_DIR, "imagefinder.html")

@app.route("/imagefinder.html")
@exige_nivel_2_ou_3
def imagefinder_html_page():
    return send_from_directory(BASE_DIR, "imagefinder.html")

@app.route("/perfis")
@exige_nivel_2_ou_3
def perfis_page():
    return send_from_directory(BASE_DIR, "perfis.html")

@app.route("/perfis.html")
@exige_nivel_2_ou_3
def perfis_html_page():
    return send_from_directory(BASE_DIR, "perfis.html")

@app.route("/vidros")
@exige_nivel_2_ou_3
def vidros_page():
    return send_from_directory(BASE_DIR, "vidros.html")

@app.route("/vidros.html")
@exige_nivel_2_ou_3
def vidros_html_page():
    return send_from_directory(BASE_DIR, "vidros.html")

@app.route("/insumos")
@exige_nivel_2_ou_3
def insumos_page():
    return send_from_directory(BASE_DIR, "insumos.html")

@app.route("/insumos.html")
@exige_nivel_2_ou_3
def insumos_html_page():
    return send_from_directory(BASE_DIR, "insumos.html")

@app.route("/Dashboard")
@exige_nivel_2_ou_3
def Dashboard_page():
    return send_from_directory(BASE_DIR, "Dashboard.html")

@app.route("/Dashboard.html")
@exige_nivel_2_ou_3
def Dashboard_html_page():
    return send_from_directory(BASE_DIR, "Dashboard.html")

@app.route("/vizualizacao")
@exige_nivel_2_ou_3
def vizualizacao_page():
    return send_from_directory(BASE_DIR, "vizualizacao.html")

@app.route("/vizualizacao.html")
@exige_nivel_2_ou_3
def vizualizacao_html_page():
    return send_from_directory(BASE_DIR, "vizualizacao.html")

@app.route("/tarefas")
@exige_nivel_2_ou_3
def task_page():
    return send_from_directory(BASE_DIR, "task.html")

@app.route("/tarefas.html")
@exige_nivel_2_ou_3
def task_html_page():
    return send_from_directory(BASE_DIR, "task.html")

@app.route("/clientes")
@exige_nivel_2_ou_3
def clientes_page():
    return send_from_directory(ROOT_DIR, "clientes.html")

@app.route("/clientes.html")
@exige_nivel_2_ou_3
def clientes_html_page():
    return send_from_directory(ROOT_DIR, "clientes.html")

# =====================
# BLUEPRINTS
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
from api_tags import tags_bp
from api_comprovantes import comprovantes_bp
from api_imagetags import imagetags_bp
from api_financeiro import api_financeiro_bp

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
app.register_blueprint(tags_bp)
app.register_blueprint(comprovantes_bp)
app.register_blueprint(imagetags_bp)
app.register_blueprint(api_financeiro_bp)

if __name__ == "__main__":
    app.run(debug=True)



