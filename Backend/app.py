import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
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
CORS(
    app,
    supports_credentials=True,
    resources={
        r"/api/*": {
            "origins": [
                "https://desenvolvimento-7dps.onrender.com"
            ]
        }
    }
)

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

@app.route("/taskmenager.html")
def taskmenager_html_page():
    return send_from_directory(BASE_DIR, "taskmenager.html")

@app.route("/taskmenager")
def taskmenager_page():
    return send_from_directory(BASE_DIR, "taskmenager.html")

# =====================
# ROTAS
# =====================

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

@app.route("/catalogo3d")
def catalogo3d_page():
    return send_from_directory(BASE_DIR, "catalogo3d.html")

@app.route("/catalogo3d.html")
def catalogo3d_html_page():
    return send_from_directory(BASE_DIR, "catalogo3d.html")

@app.route("/aprovacao")
def aprovacao_page():
    return send_from_directory(BASE_DIR, "aprovacao.html")

@app.route("/aprovacao.html")
def aprovacao_html_page():
    return send_from_directory(BASE_DIR, "aprovacao.html")

@app.route("/tags")
def tags_page():
    return send_from_directory(BASE_DIR, "tags.html")

@app.route("/tags.html")
def tags_html_page():
    return send_from_directory(BASE_DIR, "tags.html")

@app.route("/financeiro")
def financeiro_page():
    return send_from_directory(BASE_DIR, "financeiro.html")

@app.route("/financeiro.html")
def financeiro_html_page():
    return send_from_directory(BASE_DIR, "financeiro.html")

@app.route("/comprovantes")
def comprovantes_page():
    return send_from_directory(BASE_DIR, "comprovantes.html")

@app.route("/comprovantes.html")
def comprovantes_html_page():
    return send_from_directory(BASE_DIR, "comprovantes.html")

@app.route("/estruturastemp")
def estruturastemp_page():
    return send_from_directory(BASE_DIR, "estruturastemp.html")

@app.route("/estruturastemp.html")
def estruturastemp_html_page():
    return send_from_directory(BASE_DIR, "estruturastemp.html")

@app.route("/callback")
def callback_page():
    return send_from_directory(BASE_DIR, "callback.html")

@app.route("/callback.html")
def callback_html_page():
    return send_from_directory(BASE_DIR, "callback.html")

@app.route("/imagefinder")
def imagefinder_page():
    return send_from_directory(BASE_DIR, "imagefinder.html")

@app.route("/imagefinder.html")
def imagefinder_html_page():
    return send_from_directory(BASE_DIR, "imagefinder.html")

@app.route("/perfis")
def perfis_page():
    return send_from_directory(BASE_DIR, "perfis.html")

@app.route("/perfis.html")
def perfis_html_page():
    return send_from_directory(BASE_DIR, "perfis.html")

@app.route("/vidros")
def vidros_page():
    return send_from_directory(BASE_DIR, "vidros.html")

@app.route("/vidros.html")
def vidros_html_page():
    return send_from_directory(BASE_DIR, "vidros.html")

@app.route("/insumos")
def insumos_page():
    return send_from_directory(BASE_DIR, "insumos.html")

@app.route("/insumos.html")
def insumos_html_page():
    return send_from_directory(BASE_DIR, "insumos.html")

@app.route("/Dashboard")
def Dashboard_page():
    return send_from_directory(BASE_DIR, "Dashboard.html")

@app.route("/Dashboard.html")
def Dashboard_html_page():
    return send_from_directory(BASE_DIR, "Dashboard.html")

@app.route("/vizualizacao")
def vizualizacao_page():
    return send_from_directory(BASE_DIR, "vizualizacao.html")

@app.route("/vizualizacao.html")
def vizualizacao_html_page():
    return send_from_directory(BASE_DIR, "vizualizacao.html")

@app.route("/tarefas")
def task_page():
    return send_from_directory(BASE_DIR, "task.html")

@app.route("/tarefas.html")
def task_html_page():
    return send_from_directory(BASE_DIR, "task.html")

@app.route("/clientes")
def clientes_page():
    return send_from_directory(ROOT_DIR, "clientes.html")

@app.route("/clientes.html")
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
from api_task import api_task
from api_clientes import clientes_api_bp


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
app.register_blueprint(api_task)
app.register_blueprint(clientes_api_bp)

if __name__ == "__main__":
    app.run(debug=True)







