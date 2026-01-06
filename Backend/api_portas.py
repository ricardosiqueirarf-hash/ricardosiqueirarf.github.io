from flask import Blueprint, request, jsonify
import requests

portas_bp = Blueprint("portas_bp", __name__)

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

# POST para criar portas
@portas_bp.route("/api/orcamento/<orcamento_uuid>/portas", methods=["POST"])
def criar_portas(orcamento_uuid):
    from app import SUPABASE_URL, HEADERS
    data = request.json
    portas = data.get("portas", [])
    if not portas or not isinstance(portas, list):
        return jsonify({"success": False, "error": "Nenhuma porta enviada"}), 400
    try:
        r_delete = requests.delete(
            f"{SUPABASE_URL}/rest/v1/portas?orcamento_uuid=eq.{orcamento_uuid}",
            headers=HEADERS
        )
        r_delete.raise_for_status()
        payload = []
        for p in portas:
            dados_obj = p.get("dados", {})
            # converte dict para array de texto
            dados_array = [f"{k}:{v}" for k,v in dados_obj.items()]
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
        return jsonify({"success": True, "portas_salvas": portas_salvas})
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
        payload = {
            "quantidade_total": quantidade_total,
            "valor_total": valor_total
        }
        r_patch = requests.patch(
            f"{SUPABASE_URL}/rest/v1/orcamentos?uuid=eq.{orcamento_uuid}",
            headers={**HEADERS, "Content-Type": "application/json"},
            json=payload
        )
        r_patch.raise_for_status()
        return jsonify({"success": True})
    except requests.HTTPError as http_err:
        return jsonify({"success": False, "error": f"{http_err.response.status_code} {http_err.response.text}"}), http_err.response.status_code
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500





