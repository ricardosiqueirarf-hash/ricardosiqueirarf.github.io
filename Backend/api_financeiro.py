import os
import requests
from flask import Blueprint, jsonify, request, make_response

from auth_utils import buscar_usuario_por_token, extrair_token

api_financeiro_bp = Blueprint("api_financeiro_bp", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos (api_financeiro.py)")

HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}


def _int_or_default(value, default):
    try:
        return int(value)
    except Exception:
        return default


def _nivel_usuario(usuario):
    try:
        return int((usuario or {}).get("level") or 0)
    except (TypeError, ValueError):
        return 0


def _storeid_usuario(usuario):
    usuario = usuario or {}
    return str(
        usuario.get("storeid")
        or usuario.get("storeID")
        or usuario.get("lojaid")
        or usuario.get("lojaID")
        or ""
    ).strip()


def _nome_usuario(usuario):
    usuario = usuario or {}
    dados = usuario.get("dados") if isinstance(usuario.get("dados"), dict) else {}
    return str(dados.get("nome") or usuario.get("nome") or usuario.get("user") or usuario.get("userid") or "-").strip()


def _money_br(valor):
    try:
        numero = float(valor or 0)
    except (TypeError, ValueError):
        numero = 0.0
    texto = f"{numero:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {texto}"


def _status_label(valor):
    labels = {0: "Cancelado", 1: "Orçamento", 2: "Aprovado", 3: "Em Produção", 4: "Separado", 5: "Entregue"}
    try:
        v = int(valor)
    except (TypeError, ValueError):
        return str(valor or "-")
    return labels.get(v, str(v))


def _usuario_atual():
    token = extrair_token(request)
    if not token:
        return None, make_response(jsonify({"success": False, "error": "Sessão não informada."}), 401)
    try:
        usuario = buscar_usuario_por_token(token)
    except Exception as exc:
        return None, make_response(jsonify({"success": False, "error": str(exc)}), 500)
    if not usuario:
        return None, make_response(jsonify({"success": False, "error": "Sessão inválida."}), 401)
    return usuario, None


def _telegram_send(texto):
    import api_orcamentos as tg
    cfg = tg.load_telegram_env()
    bot_token = cfg.get("TELEGRAM_" + "TOKEN")
    chat_id = cfg.get("TELEGRAM_" + "CHAT_ID")
    if not bot_token or not chat_id:
        raise RuntimeError("Bot Telegram não configurado.")
    url = tg._telegram_api_url(bot_token, "send" + "Message")
    r = requests.post(url, json={"chat_id": chat_id, "text": texto}, timeout=15)
    r.raise_for_status()
    payload = r.json()
    if not payload.get("ok"):
        raise RuntimeError(payload.get("description") or "Telegram recusou a mensagem.")
    return payload


@api_financeiro_bp.route("/api/financeiro", methods=["GET"])
def api_financeiro():
    """
    Retorna orçamentos com status aprovados.

    Regra de segurança:
      - nível 3: vê todos os orçamentos;
      - qualquer outro nível: vê somente orçamentos do próprio storeid/lojaid.
    """
    token = extrair_token(request)
    if not token:
        return make_response(jsonify({"error": "Token não informado."}), 401)

    try:
        usuario = buscar_usuario_por_token(token)
    except Exception as e:
        return make_response(jsonify({"error": str(e)}), 500)

    if not usuario:
        return make_response(jsonify({"error": "Token inválido."}), 401)

    level = _nivel_usuario(usuario)
    storeid = _storeid_usuario(usuario)

    if level != 3 and not storeid:
        return make_response(jsonify({"error": "Loja não vinculada ao usuário."}), 403)

    status_raw = (request.args.get("status") or "2,3,4,5").strip()
    status_list = [s.strip() for s in status_raw.split(",") if s.strip().isdigit()]
    if not status_list:
        status_list = ["2", "3", "4", "5"]

    limit = _int_or_default(request.args.get("limit"), 500)
    limit = max(1, min(limit, 2000))

    order = (request.args.get("order") or "numero_pedido.asc").strip()

    select_campos = ",".join([
        "id",
        "numero_pedido",
        "cliente_nome",
        "data_criacao",
        "data_aprovacao",
        "status",
        "valor_total",
        "valor_pago",
        "lojaid",
        "quantidade_total"
    ])

    params = {
        "select": select_campos,
        "status": f"in.({','.join(status_list)})",
        "order": order,
        "limit": str(limit),
    }

    if level != 3:
        params["lojaid"] = f"eq.{storeid}"

    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/orcamentos",
            headers=HEADERS,
            params=params,
            timeout=15
        )
    except Exception as e:
        return make_response(jsonify({
            "error": "Falha de rede ao consultar Supabase",
            "details": str(e)
        }), 500)

    if not r.ok:
        return make_response(jsonify({
            "error": "Supabase retornou erro",
            "status_code": r.status_code,
            "details": r.text
        }), 500)

    return jsonify(r.json())


@api_financeiro_bp.route("/api/financeiro/controle-log", methods=["POST"])
def controle_log():
    usuario, erro = _usuario_atual()
    if erro:
        return erro

    data = request.get_json(silent=True) or {}
    tipo = str(data.get("tipo") or "alteracao").strip()
    uuid = str(data.get("uuid") or "-").strip()
    numero_pedido = data.get("numero_pedido") or "-"
    cliente_nome = data.get("cliente_nome") or "-"
    loja = data.get("loja") or data.get("lojaid") or "-"
    valor_total = data.get("valor_total")
    usuario_nome = _nome_usuario(usuario)

    if tipo == "status":
        anterior = data.get("status_anterior")
        novo = data.get("status_novo")
        titulo = "LOG CONTROLE - STATUS ALTERADO"
        detalhe = f"Status: {_status_label(anterior)} ({anterior}) -> {_status_label(novo)} ({novo})"
    elif tipo == "valor_pago":
        anterior = data.get("valor_anterior")
        novo = data.get("valor_novo")
        titulo = "LOG CONTROLE - VALOR PAGO ALTERADO"
        detalhe = f"Valor pago: {_money_br(anterior)} -> {_money_br(novo)}"
    else:
        titulo = "LOG CONTROLE - ALTERACAO"
        detalhe = "Alteracao registrada no controle."

    texto = (
        f"{titulo}\n\n"
        f"Pedido: {numero_pedido}\n"
        f"Cliente: {cliente_nome}\n"
        f"Loja: {loja}\n"
        f"Valor total: {_money_br(valor_total)}\n"
        f"{detalhe}\n\n"
        f"Usuario: {usuario_nome}\n"
        f"UUID: {uuid}"
    )

    try:
        _telegram_send(texto)
        return jsonify({"success": True, "message": "Log enviado."})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
