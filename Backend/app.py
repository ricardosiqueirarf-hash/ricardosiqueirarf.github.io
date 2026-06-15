import os
from flask import Flask, jsonify, send_from_directory, make_response, request
from flask_cors import CORS 
import jwt
import datetime

# =====================
# CONFIG GLOBAL
# =====================

SUPABASE_URL = os.getenv("SUPABASE_URL")

# chave antiga mantida (caso você use em JWT ou outro ponto)
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# NOVO: service role (backend)
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

SUPABASE_TABLE_ESTRUTURAS3D = os.getenv("SUPABASE_TABLE_ESTRUTURAS3D", "estruturas")
TOKEN_DO_ADMIN = os.getenv("tokendoadmin") or os.getenv("TOKENDOADMIN")
JWT_SECRET = os.getenv("JWT_SECRET") or SUPABASE_KEY

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos")

# HEADERS agora usam SERVICE ROLE (bypass RLS)
HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json"
}

# =====================
# APP
# =====================

ALLOWED_CORS_ORIGINS = {
    "https://colorglass.onrender.com",
    "https://www.colorglassfortaleza.com.br",
    "https://colorglassfortaleza.com.br",
    "https://ricardosiqueirarf-hash.github.io",
    "https://ricardosiqueirarf.github.io",
    "http://localhost:3000",
    "http://localhost:5000",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5000",
    "http://127.0.0.1:8080",
}

app = Flask(__name__)
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": list(ALLOWED_CORS_ORIGINS),
            "allow_headers": ["Content-Type", "Authorization", "X-Auth-Token"],
            "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            "supports_credentials": True,
        }
    }
)


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin in ALLOWED_CORS_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Auth-Token"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    return response


@app.route("/api/<path:unused_path>", methods=["OPTIONS"])
def api_preflight(unused_path):
    return make_response("", 204)


# =====================
# GUARDA CENTRAL DE APIs SENSÍVEIS
# =====================
# Fase 3 conservadora: exige login nas APIs que expõem ou alteram pedidos,
# pagamentos e financeiro. Mantém login/cadastro/validar livres.
AUTH_REQUIRED_PREFIXES = (
    "/api/orcamentos",
    "/api/orcamento",
    "/api/financeiro",
    "/api/pagamentos",
)

ADMIN_REQUIRED_EXACT_PATHS = {
    "/api/usuarios",
}


@app.before_request
def proteger_apis_sensiveis():
    if request.method == "OPTIONS":
        return None

    path = request.path or ""
    precisa_auth = any(path.startswith(prefix) for prefix in AUTH_REQUIRED_PREFIXES)
    precisa_admin = path in ADMIN_REQUIRED_EXACT_PATHS

    if not precisa_auth and not precisa_admin:
        return None

    try:
        from auth_utils import buscar_usuario_por_token, extrair_token
        token = extrair_token(request)
        usuario = buscar_usuario_por_token(token) if token else None
    except Exception as exc:
        print(f"[AUTH] erro_middleware path={path} erro={exc}")
        return jsonify({"success": False, "error": "Falha ao validar sessão."}), 401

    if not usuario:
        return jsonify({"success": False, "error": "Sessão inválida ou expirada. Faça login novamente."}), 401

    try:
        level = int((usuario or {}).get("level") or 0)
    except (TypeError, ValueError):
        level = 0

    if precisa_admin and level != 3:
        return jsonify({"success": False, "error": "Acesso negado. Requer administrador."}), 403

    request.usuario_auth = usuario
    return None


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
STATIC_DIR = os.path.join(ROOT_DIR, "static")


def send_html(filename):
    static_path = os.path.join(STATIC_DIR, filename)
    if os.path.exists(static_path):
        return send_from_directory(STATIC_DIR, filename)
    return send_from_directory(BASE_DIR, filename)

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
    return send_html("inicio.html")

@app.route("/inicio.html")
def inicio_html_page():
    return send_html("inicio.html")

@app.route("/login.html")
def login_html_page():
    return send_html("login.html")

@app.route("/login")
def login_page():
    return send_html("login.html")

@app.route("/logincadastro.html")
def login_cadastro_html_page():
    return send_html("login.html")

@app.route("/cadastro.html")
def cadastro_html_page():
    return send_html("cadastro.html")

@app.route("/cadastro")
def cadastro_page():
    return send_html("cadastro.html")

@app.route("/taskmenager.html")
def taskmenager_html_page():
    return send_html("taskmenager.html")

@app.route("/taskmenager")
def taskmenager_page():
    return send_html("taskmenager.html")

# =====================
# ROTAS
# =====================

@app.route("/loja")
def index_loja_page():
    return send_html("index_loja.html")

@app.route("/index_loja.html")
def index_loja_html_page():
    return send_html("index_loja.html")

@app.route("/index.html")
def index_admin_page():
    return send_html("index.html")

@app.route("/admin")
def admin_dashboard_page():
    return send_html("index_admin.html")

@app.route("/index_admin.html")
def index_admin_html_page():
    return send_html("index_admin.html")

@app.route("/usuarios_admin")
def usuarios_admin_page():
    return send_html("usuarios_admin.html")

@app.route("/usuarios_admin.html")
def usuarios_admin_html_page():
    return send_html("usuarios_admin.html")

@app.route("/portas")
def portas_page():
    return send_html("portas.html")

@app.route("/portas.html")
def portas_html_page():
    return send_html("portas.html")

@app.route("/catalogo3d")
def catalogo3d_page():
    return send_html("catalogo3d.html")

@app.route("/catalogo3d.html")
def catalogo3d_html_page():
    return send_html("catalogo3d.html")

@app.route("/aprovacao")
def aprovacao_page():
    return send_html("aprovacao.html")

@app.route("/aprovacao.html")
def aprovacao_html_page():
    return send_html("aprovacao.html")

@app.route("/controle")
def controle_page():
    return send_html("gerenciar_aprovados.html")

@app.route("/controle.html")
def controle_html_page():
    return send_html("gerenciar_aprovados.html")

@app.route("/controle_loja")
def controle_loja_page():
    return send_html("controle_loja.html")

@app.route("/controle_loja.html")
def controle_loja_html_page():
    return send_html("controle_loja.html")

@app.route("/tags")
def tags_page():
    return send_html("tags.html")

@app.route("/tags.html")
def tags_html_page():
    return send_html("tags.html")

@app.route("/financeiro")
def financeiro_page():
    return send_html("financeiro.html")

@app.route("/financeiro.html")
def financeiro_html_page():
    return send_html("financeiro.html")

@app.route("/comprovantes")
def comprovantes_page():
    return send_html("comprovantes.html")

@app.route("/comprovantes.html")
def comprovantes_html_page():
    return send_html("comprovantes.html")

@app.route("/estruturastemp")
def estruturastemp_page():
    return send_html("estruturastemp.html")

@app.route("/estruturastemp.html")
def estruturastemp_html_page():
    return send_html("estruturastemp.html")

@app.route("/callback")
def callback_page():
    return send_html("callback.html")

@app.route("/callback.html")
def callback_html_page():
    return send_html("callback.html")

@app.route("/imagefinder")
def imagefinder_page():
    return send_html("imagefinder.html")

@app.route("/imagefinder.html")
def imagefinder_html_page():
    return send_html("imagefinder.html")

@app.route("/perfis")
def perfis_page():
    return send_html("perfis.html")

@app.route("/perfis.html")
def perfis_html_page():
    return send_html("perfis.html")

@app.route("/vidros")
def vidros_page():
    return send_html("vidros.html")

@app.route("/vidros.html")
def vidros_html_page():
    return send_html("vidros.html")

@app.route("/insumos")
def insumos_page():
    return send_html("insumos.html")

@app.route("/insumos.html")
def insumos_html_page():
    return send_html("insumos.html")

@app.route("/Dashboard")
def Dashboard_page():
    return send_html("Dashboard.html")

@app.route("/Dashboard.html")
def Dashboard_html_page():
    return send_html("Dashboard.html")

@app.route("/vizualizacao")
def vizualizacao_page():
    return send_html("vizualizacao.html")

@app.route("/vizualizacao.html")
def vizualizacao_html_page():
    return send_html("vizualizacao.html")

@app.route("/tarefas")
def task_page():
    return send_html("task.html")

@app.route("/tarefas.html")
def task_html_page():
    return send_html("task.html")

@app.route("/clientes")
def clientes_page():
    if os.path.exists(os.path.join(STATIC_DIR, "clientes.html")):
        return send_from_directory(STATIC_DIR, "clientes.html")
    return send_from_directory(ROOT_DIR, "clientes.html")

@app.route("/clientes.html")
def clientes_html_page():
    if os.path.exists(os.path.join(STATIC_DIR, "clientes.html")):
        return send_from_directory(STATIC_DIR, "clientes.html")
    return send_from_directory(ROOT_DIR, "clientes.html")

@app.route("/promob_export")
def promob_export_page():
    return send_html("promob_export.html")

def _crm_directory():
    static_crm_dir = os.path.join(STATIC_DIR, "crm")
    if os.path.exists(os.path.join(static_crm_dir, "index.html")):
        return static_crm_dir
    return os.path.join(ROOT_DIR, "CRM")

@app.route("/crm")
@app.route("/crm/")
def crm_page():
    return send_from_directory(_crm_directory(), "index.html")

@app.route("/crm/index.html")
@app.route("/CRM")
@app.route("/CRM/index.html")
def crm_index_html_page():
    return send_from_directory(_crm_directory(), "index.html")

@app.route("/promob_export.html")
def promob_export_html_page():
    return send_html("promob_export.html")

@app.route("/gestao-carteira")
def gestao_carteira_page():
    return send_html("gestao-carteira.html")

@app.route("/gestao-carteira.html")
def gestao_carteira_html_page():
    return send_html("gestao-carteira.html")

@app.route("/pagamentos")
def pagamentos_page():
    return send_html("pagamentos.html")

@app.route("/pagamentos.html")
def pagamentos_html_page():
    return send_html("pagamentos.html")

@app.route("/fornecedores")
def fornecedores_page():
    return send_html("fornecedores.html")

@app.route("/fornecedores.html")
def fornecedores_html_page():
    return send_html("fornecedores.html")

@app.route("/estoquecontagens")
def estoquecontagens_page():
    return send_html("estoquecontagens.html")

@app.route("/estoquecontagens.html")
def estoquecontagens_html_page():
    return send_html("estoquecontagens.html")

@app.route("/estoquedashboard")
def estoquedashboard_page():
    return send_html("estoquedashboard.html")

@app.route("/estoquedashboard.html")
def estoquedashboard_html_page():
    return send_html("estoquedashboard.html")

@app.route("/3dteste")
def d3teste_page():
    if os.path.exists(os.path.join(STATIC_DIR, "3dteste.html")):
        return send_from_directory(STATIC_DIR, "3dteste.html")
    return send_from_directory(ROOT_DIR, "3dteste.html")

@app.route("/3dteste.html")
def d3teste_html_page():
    if os.path.exists(os.path.join(STATIC_DIR, "3dteste.html")):
        return send_from_directory(STATIC_DIR, "3dteste.html")
    return send_from_directory(ROOT_DIR, "3dteste.html")

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
from api_admin_usuarios import admin_usuarios_bp
from api_tags import tags_bp
from api_comprovantes import comprovantes_bp
from api_imagetags import imagetags_bp
from api_financeiro import api_financeiro_bp
from api_task import api_task
from api_clientes import clientes_api_bp
from api_export_promob import export_promob_bp
from api_sistemas import sistemas_bp
from api_trilhos import trilhos_bp
from api_fornecedores import fornecedores_bp

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
app.register_blueprint(admin_usuarios_bp)
app.register_blueprint(tags_bp)
app.register_blueprint(comprovantes_bp)
app.register_blueprint(imagetags_bp)
app.register_blueprint(api_financeiro_bp)
app.register_blueprint(api_task)
app.register_blueprint(clientes_api_bp)
app.register_blueprint(export_promob_bp) 
app.register_blueprint(sistemas_bp)
app.register_blueprint(trilhos_bp)
app.register_blueprint(fornecedores_bp)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
