import os
import requests
from flask import Blueprint, jsonify, request, make_response

from auth_utils import buscar_usuario_por_token, extrair_token

api_financeiro_bp = Blueprint("api_financeiro_bp", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
LOGS_TABLE = os.getenv("SUPABASE_TABLE_LOGS_SISTEMA", "logs_sistema")

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


def _int_or_none(value):
    try:
        return int(value)
    except Exception:
        return None


def _uuid_or_none(value):
    texto = str(value or "").strip()
    return texto or None


def _client_ip():
    forwarded = request.headers.get("X-Forwarded-For") or ""
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    return request.remote_addr or "unknown"


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


def _buscar_nome_usuario(usuario):
    usuario = usuario or {}
    userid = str(usuario.get("userid") or "").strip()
    fallback = _nome_usuario(usuario)
    if not userid:
        return fallback

    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/usuarios",
            headers=HEADERS,
            params={
                "select": "userid,user,nome,dados",
                "userid": f"eq.{userid}",
                "limit": "1",
            },
            timeout=10,
        )
        r.raise_for_status()
        linhas = r.json() or []
        if not linhas:
            return fallback

        row = linhas[0] or {}
        dados = row.get("dados") if isinstance(row.get("dados"), dict) else {}
        nome = dados.get("nome") or row.get("nome") or row.get("user") or fallback
        return str(nome or fallback or "-").strip()
    except Exception as exc:
        print(f"[CONTROLE_LOG] Falha ao buscar nome do usuário {userid}: {exc}")
        return fallback


def _registrar_log_sistema(
    *,
    usuario,
    categoria,
    acao,
    severidade="info",
    origem=None,
    entidade_tipo=None,
    entidade_id=None,
    numero_pedido=None,
    valor_anterior=None,
    valor_novo=None,
    resumo=None,
    metadata=None,
):
    usuario = usuario or {}
    metadata = metadata if isinstance(metadata, dict) else {}
    valor_anterior = valor_anterior if isinstance(valor_anterior, dict) else ({} if valor_anterior is None else {"valor": valor_anterior})
    valor_novo = valor_novo if isinstance(valor_novo, dict) else ({} if valor_novo is None else {"valor": valor_novo})

    payload = {
        "usuario_id": _uuid_or_none(usuario.get("userid")),
        "usuario_nome": _buscar_nome_usuario(usuario),
        "usuario_user": usuario.get("user"),
        "usuario_level": _int_or_none(usuario.get("level")),
        "storeid": _storeid_usuario(usuario) or None,
        "categoria": categoria,
        "acao": acao,
        "severidade": severidade or "info",
        "origem": origem,
        "ip": _client_ip(),
        "user_agent": request.headers.get("User-Agent") or "",
        "entidade_tipo": entidade_tipo,
        "entidade_id": _uuid_or_none(entidade_id),
        "numero_pedido": _int_or_none(numero_pedido),
        "valor_anterior": valor_anterior,
        "valor_novo": valor_novo,
        "resumo": resumo,
        "metadata": metadata,
    }

    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/{LOGS_TABLE}",
            headers={**HEADERS, "Prefer": "return=minimal"},
            json=payload,
            timeout=10,
        )
        r.raise_for_status()
        return True
    except Exception as exc:
        print(f"[LOGS_SISTEMA] Falha ao registrar {categoria}.{acao}: {exc}")
        return False


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


def _level_label(valor):
    labels = {1: "Loja", 2: "Gerência", 3: "Admin", 4: "Logística"}
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
    acesso_global = level in (2, 3, 4)

    if not acesso_global and not storeid:
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

    if not acesso_global:
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
    usuario_nome = _buscar_nome_usuario(usuario)

    if tipo == "login":
        titulo = "LOG LOGIN - ACESSO AUTORIZADO"
        level = data.get("level") or usuario.get("level") or "-"
        data_acesso = data.get("data_acesso") or "-"
        hora_acesso = data.get("hora_acesso") or "-"
        ip = data.get("ip") or _client_ip()
        resumo = f"{usuario_nome} acessou o sistema"
        _registrar_log_sistema(
            usuario=usuario,
            categoria="login",
            acao="acesso_autorizado",
            severidade="info",
            origem=data.get("origem") or "login.html",
            resumo=resumo,
            metadata={"data_acesso": data_acesso, "hora_acesso": hora_acesso, "ip_informado": ip},
        )
        texto = (
            f"{titulo}\n\n"
            f"Nome: {usuario_nome}\n"
            f"Nivel: {level} - {_level_label(level)}\n"
            f"Loja/StoreID: {_storeid_usuario(usuario) or '-'}\n"
            f"Data: {data_acesso}\n"
            f"Horario: {hora_acesso}\n"
            f"IP: {ip}"
        )
    elif tipo == "status":
        anterior = data.get("status_anterior")
        novo = data.get("status_novo")
        titulo = "LOG CONTROLE - STATUS ALTERADO"
        detalhe = f"Status: {_status_label(anterior)} ({anterior}) -> {_status_label(novo)} ({novo})"
        resumo = f"Pedido {numero_pedido} alterado de {_status_label(anterior)} para {_status_label(novo)}"
        _registrar_log_sistema(
            usuario=usuario,
            categoria="orcamento",
            acao="status_alterado",
            severidade="info",
            origem=data.get("origem") or "controle.html",
            entidade_tipo="orcamento",
            entidade_id=uuid,
            numero_pedido=numero_pedido,
            valor_anterior={"status": anterior, "label": _status_label(anterior)},
            valor_novo={"status": novo, "label": _status_label(novo)},
            resumo=resumo,
            metadata={"cliente_nome": cliente_nome, "loja": loja, "valor_total": valor_total},
        )
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
    elif tipo == "valor_pago":
        anterior = data.get("valor_anterior")
        novo = data.get("valor_novo")
        titulo = "LOG CONTROLE - VALOR PAGO ALTERADO"
        detalhe = f"Valor pago: {_money_br(anterior)} -> {_money_br(novo)}"
        resumo = f"Valor pago do pedido {numero_pedido} alterado de {_money_br(anterior)} para {_money_br(novo)}"
        _registrar_log_sistema(
            usuario=usuario,
            categoria="financeiro",
            acao="valor_pago_alterado",
            severidade="alerta",
            origem=data.get("origem") or "controle.html",
            entidade_tipo="orcamento",
            entidade_id=uuid,
            numero_pedido=numero_pedido,
            valor_anterior={"valor_pago": anterior},
            valor_novo={"valor_pago": novo},
            resumo=resumo,
            metadata={"cliente_nome": cliente_nome, "loja": loja, "valor_total": valor_total},
        )
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
    else:
        titulo = "LOG CONTROLE - ALTERACAO"
        detalhe = "Alteracao registrada no controle."
        _registrar_log_sistema(
            usuario=usuario,
            categoria="sistema",
            acao="alteracao_generica",
            severidade="info",
            origem=data.get("origem") or "api",
            entidade_id=uuid,
            numero_pedido=numero_pedido,
            resumo=detalhe,
            metadata=data,
        )
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
