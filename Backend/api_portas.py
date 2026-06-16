from flask import Blueprint, request, jsonify
import os
import requests

from auth_utils import buscar_usuario_por_token, extrair_token

portas_bp = Blueprint("portas_bp", __name__)
LOGS_TABLE = os.getenv("SUPABASE_TABLE_LOGS_SISTEMA", "logs_sistema")


def _client_ip():
    forwarded = request.headers.get("X-Forwarded-For") or ""
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    return request.remote_addr or "unknown"


def _usuario_request():
    token = extrair_token(request)
    if not token:
        return {}
    try:
        return buscar_usuario_por_token(token) or {}
    except Exception:
        return {}


def _nome_usuario(usuario):
    usuario = usuario or {}
    dados = usuario.get("dados") if isinstance(usuario.get("dados"), dict) else {}
    return dados.get("nome") or usuario.get("nome") or usuario.get("user") or usuario.get("userid") or "-"


def _storeid(usuario):
    usuario = usuario or {}
    return usuario.get("storeid") or usuario.get("lojaid") or usuario.get("storeID") or usuario.get("lojaID")


def _int_or_none(valor):
    try:
        return int(valor)
    except Exception:
        return None


def _money_br(valor):
    try:
        numero = float(valor or 0)
    except (TypeError, ValueError):
        numero = 0.0
    texto = f"{numero:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {texto}"


def _buscar_orcamento(orcamento_uuid):
    from app import SUPABASE_URL, HEADERS
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/orcamentos",
        headers=HEADERS,
        params={
            "select": "id,numero_pedido,cliente_nome,lojaid,valor_total,quantidade_total,status",
            "id": f"eq.{orcamento_uuid}",
            "limit": "1",
        },
        timeout=10,
    )
    r.raise_for_status()
    rows = r.json() or []
    return rows[0] if rows else {}


def _contar_portas_existentes(orcamento_uuid):
    from app import SUPABASE_URL, HEADERS
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/portas",
        headers=HEADERS,
        params={
            "select": "id,tipo,quantidade,preco",
            "orcamento_uuid": f"eq.{orcamento_uuid}",
        },
        timeout=10,
    )
    r.raise_for_status()
    portas = r.json() or []
    return {
        "qtd_modelos": len(portas),
        "quantidade_total": sum(_int_or_none(p.get("quantidade")) or 1 for p in portas),
        "valor_total": round(sum(float(p.get("preco") or 0) for p in portas), 2),
        "tipos": [p.get("tipo") for p in portas if p.get("tipo")],
    }


def _registrar_log(usuario, orcamento_uuid, orcamento, anterior, novo):
    from app import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    usuario = usuario or {}
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "return=minimal",
    }
    payload = {
        "usuario_id": usuario.get("userid"),
        "usuario_nome": _nome_usuario(usuario),
        "usuario_user": usuario.get("user"),
        "usuario_level": _int_or_none(usuario.get("level")),
        "storeid": _storeid(usuario),
        "categoria": "orcamento",
        "acao": "portas_alteradas",
        "severidade": "info",
        "origem": "api_portas",
        "ip": _client_ip(),
        "user_agent": request.headers.get("User-Agent") or "",
        "entidade_tipo": "orcamento",
        "entidade_id": orcamento_uuid,
        "numero_pedido": _int_or_none(orcamento.get("numero_pedido")),
        "valor_anterior": anterior if isinstance(anterior, dict) else {},
        "valor_novo": novo if isinstance(novo, dict) else {},
        "resumo": f"Portas do orçamento {orcamento.get('numero_pedido') or orcamento_uuid} foram alteradas",
        "metadata": {
            "cliente_nome": orcamento.get("cliente_nome"),
            "lojaid": orcamento.get("lojaid"),
            "status": orcamento.get("status"),
        },
    }
    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/{LOGS_TABLE}",
            headers=headers,
            json=payload,
            timeout=10,
        )
        r.raise_for_status()
    except Exception as exc:
        print(f"[PORTAS_LOG] Falha ao registrar log: {exc}")


def _telegram_send(texto):
    try:
        import api_orcamentos as tg
        cfg = tg.load_telegram_env()
        bot_token = cfg.get("TELEGRAM_" + "TOKEN")
        chat_id = cfg.get("TELEGRAM_" + "CHAT_ID")
        if not bot_token or not chat_id:
            raise RuntimeError("Bot Telegram não configurado.")
        url = tg._telegram_api_url(bot_token, "send" + "Message")
        r = requests.post(url, json={"chat_id": chat_id, "text": texto}, timeout=15)
        r.raise_for_status()
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(data.get("description") or "Telegram recusou a mensagem.")
    except Exception as exc:
        print(f"[PORTAS_LOG] Falha ao enviar Telegram: {exc}")


# =====================
# ROTAS PORTAS
# =====================

# GET todas as portas de um orçamento
@portas_bp.route("/api/orcamento/<orcamento_uuid>/portas", methods=["GET"])
def listar_portas(orcamento_uuid):
    from app import SUPABASE_URL, HEADERS
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/portas?orcamento_uuid=eq.{orcamento_uuid}",
            headers=HEADERS
        )
        r.raise_for_status()
        portas = r.json()
        # converte text[] de volta para dict
        for p in portas:
            dados_array = p.get("dados", [])
            dados = {}
            if isinstance(dados_array, list):
                for item in dados_array:
                    if ":" not in item:
                        continue
                    key, value = item.split(":", 1)
                    if key == "dobradicas_alturas":
                        valores = [v.strip() for v in value.split(",") if v.strip()]
                        dados[key] = valores
                    else:
                        dados[key] = value
            p["dados"] = dados
            p["quantidade"] = int(p.get("quantidade", 1))
        return jsonify({"success": True, "portas": portas})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# POST para substituir as portas de um orçamento
@portas_bp.route("/api/orcamento/<orcamento_uuid>/portas", methods=["POST"])
def criar_portas(orcamento_uuid):
    from app import SUPABASE_URL, HEADERS
    data = request.json or {}
    portas = data.get("portas", [])
    if not isinstance(portas, list):
        return jsonify({"success": False, "error": "Formato inválido para portas"}), 400
    try:
        usuario = _usuario_request()
        orcamento_antes = _buscar_orcamento(orcamento_uuid)
        portas_antes = _contar_portas_existentes(orcamento_uuid)

        r_delete = requests.delete(
            f"{SUPABASE_URL}/rest/v1/portas?orcamento_uuid=eq.{orcamento_uuid}",
            headers=HEADERS
        )
        r_delete.raise_for_status()

        portas_salvas = []
        if portas:
            payload = []
            for p in portas:
                dados_obj = p.get("dados", {})
                # converte dict para array de texto
                dados_array = [f"{k}:{v}" for k, v in dados_obj.items()]
                payload.append({
                    "orcamento_uuid": p.get("orcamento_uuid", orcamento_uuid),
                    "tipo": p.get("tipo"),
                    "dados": dados_array,
                    "quantidade": p.get("quantidade", 1),
                    "preco": p.get("preco"),
                    "svg": p.get("svg")
                })
            r_post = requests.post(
                f"{SUPABASE_URL}/rest/v1/portas",
                headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"},
                json=payload
            )
            r_post.raise_for_status()
            portas_salvas = r_post.json()

        quantidade_total = 0
        valor_total = 0.0
        for p in portas:
            qtd = int(p.get("quantidade", 1) or 1)
            preco = float(p.get("preco", 0) or 0)
            quantidade_total += qtd
            # O preço da porta já vem calculado com a quantidade no frontend.
            # Não multiplica novamente para evitar inflar o valor_total exibido na loja.
            valor_total += preco

        payload_orcamento = {
            "quantidade_total": quantidade_total,
            "valor_total": round(valor_total, 2)
        }
        r_patch_orc = requests.patch(
            f"{SUPABASE_URL}/rest/v1/orcamentos?id=eq.{orcamento_uuid}",
            headers={**HEADERS, "Content-Type": "application/json"},
            json=payload_orcamento
        )
        r_patch_orc.raise_for_status()

        orcamento_depois = _buscar_orcamento(orcamento_uuid) or orcamento_antes
        novo = {
            "qtd_modelos": len(portas_salvas),
            "quantidade_total": quantidade_total,
            "valor_total": round(valor_total, 2),
            "tipos": [p.get("tipo") for p in portas if p.get("tipo")],
        }
        _registrar_log(usuario, orcamento_uuid, orcamento_depois, portas_antes, novo)
        _telegram_send(
            "LOG PORTAS - PORTAS CRIADAS/ALTERADAS\n\n"
            f"Pedido: {orcamento_depois.get('numero_pedido') or '-'}\n"
            f"Cliente: {orcamento_depois.get('cliente_nome') or '-'}\n"
            f"Modelos antes: {portas_antes.get('qtd_modelos') or 0}\n"
            f"Modelos agora: {novo.get('qtd_modelos') or 0}\n"
            f"Qtd antes: {portas_antes.get('quantidade_total') or 0}\n"
            f"Qtd agora: {quantidade_total}\n"
            f"Valor antes: {_money_br(portas_antes.get('valor_total'))}\n"
            f"Valor agora: {_money_br(valor_total)}\n"
            f"Usuário: {_nome_usuario(usuario)}\n"
            f"UUID: {orcamento_uuid}"
        )

        return jsonify({
            "success": True,
            "portas_salvas": portas_salvas,
            "quantidade_total": quantidade_total,
            "valor_total": round(valor_total, 2)
        })
    except requests.HTTPError as http_err:
        return jsonify({"success": False, "error": f"{http_err.response.status_code} {http_err.response.text}"}), http_err.response.status_code
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# POST para finalizar orçamento (atualiza quantidade_total e valor_total)
@portas_bp.route("/api/orcamento/<orcamento_uuid>/finalizar", methods=["POST"])
def finalizar_orcamento(orcamento_uuid):
    from app import SUPABASE_URL, HEADERS
    data = request.json
    quantidade_total = data.get("quantidade_total", 0)
    valor_total = data.get("valor_total", 0)
    try:
        usuario = _usuario_request()
        orcamento_antes = _buscar_orcamento(orcamento_uuid)
        anterior = {
            "quantidade_total": orcamento_antes.get("quantidade_total"),
            "valor_total": orcamento_antes.get("valor_total"),
        }
        payload = {
            "quantidade_total": quantidade_total,
            "valor_total": valor_total
        }
        r_patch = requests.patch(
            f"{SUPABASE_URL}/rest/v1/orcamentos?id=eq.{orcamento_uuid}",
            headers={**HEADERS, "Content-Type": "application/json"},
            json=payload
        )
        r_patch.raise_for_status()
        orcamento_depois = _buscar_orcamento(orcamento_uuid) or orcamento_antes
        novo = {
            "quantidade_total": quantidade_total,
            "valor_total": valor_total,
        }
        _registrar_log(usuario, orcamento_uuid, orcamento_depois, anterior, novo)
        _telegram_send(
            "LOG PORTAS - TOTAIS FINALIZADOS\n\n"
            f"Pedido: {orcamento_depois.get('numero_pedido') or '-'}\n"
            f"Cliente: {orcamento_depois.get('cliente_nome') or '-'}\n"
            f"Valor anterior: {_money_br(anterior.get('valor_total'))}\n"
            f"Valor novo: {_money_br(valor_total)}\n"
            f"Qtd anterior: {anterior.get('quantidade_total') or 0}\n"
            f"Qtd nova: {quantidade_total}\n"
            f"Usuário: {_nome_usuario(usuario)}\n"
            f"UUID: {orcamento_uuid}"
        )
        return jsonify({"success": True})
    except requests.HTTPError as http_err:
        return jsonify({"success": False, "error": f"{http_err.response.status_code} {http_err.response.text}"}), http_err.response.status_code
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
