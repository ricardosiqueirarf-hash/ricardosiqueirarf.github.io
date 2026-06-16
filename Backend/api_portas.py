from flask import Blueprint, request, jsonify
import requests

from auth_utils import buscar_usuario_por_token, extrair_token
from logger_sistema import log_portas_alteradas, log_orcamento_alterado

portas_bp = Blueprint("portas_bp", __name__)


def _usuario_request():
    token = extrair_token(request)
    if not token:
        return {}
    try:
        return buscar_usuario_por_token(token) or {}
    except Exception:
        return {}


def _int_or_none(valor):
    try:
        return int(valor)
    except Exception:
        return None


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


# =====================
# ROTAS PORTAS
# =====================

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


@portas_bp.route("/api/orcamento/<orcamento_uuid>/portas", methods=["POST"])
def criar_portas(orcamento_uuid):
    from app import SUPABASE_URL, HEADERS
    data = request.json or {}
    portas = data.get("portas", [])
    if not isinstance(portas, list):
        return jsonify({"success": False, "error": "Formato inválido para portas"}), 400
    try:
        usuario = _usuario_request()
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

        orcamento_depois = _buscar_orcamento(orcamento_uuid)
        novo = {
            "qtd_modelos": len(portas_salvas),
            "quantidade_total": quantidade_total,
            "valor_total": round(valor_total, 2),
            "tipos": [p.get("tipo") for p in portas if p.get("tipo")],
        }
        log_portas_alteradas(usuario, orcamento_depois, portas_antes, novo, enviar_telegram_alerta=True)

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


@portas_bp.route("/api/orcamento/<orcamento_uuid>/finalizar", methods=["POST"])
def finalizar_orcamento(orcamento_uuid):
    from app import SUPABASE_URL, HEADERS
    data = request.json or {}
    quantidade_total = data.get("quantidade_total", 0)
    valor_total = data.get("valor_total", 0)
    try:
        usuario = _usuario_request()
        orcamento_antes = _buscar_orcamento(orcamento_uuid)
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
        log_orcamento_alterado(
            usuario,
            {
                "id": orcamento_uuid,
                "numero_pedido": orcamento_antes.get("numero_pedido"),
                "cliente_nome": orcamento_antes.get("cliente_nome"),
                "quantidade_total": orcamento_antes.get("quantidade_total"),
                "valor_total": orcamento_antes.get("valor_total"),
            },
            {
                "id": orcamento_uuid,
                "numero_pedido": orcamento_depois.get("numero_pedido"),
                "cliente_nome": orcamento_depois.get("cliente_nome"),
                "quantidade_total": quantidade_total,
                "valor_total": valor_total,
            },
            acao="totais_finalizados",
            resumo=f"Totais do orçamento {orcamento_depois.get('numero_pedido') or orcamento_uuid} foram finalizados",
            enviar_telegram_alerta=True,
        )
        return jsonify({"success": True})
    except requests.HTTPError as http_err:
        return jsonify({"success": False, "error": f"{http_err.response.status_code} {http_err.response.text}"}), http_err.response.status_code
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
