from flask import Blueprint, request, jsonify
import requests

portas_bp = Blueprint("portas_bp", __name__)

# =====================
# UTILITÁRIOS PORTAS / CÁLCULO
# =====================


def _dados_array_para_dict(dados_array):
    dados = {}
    if isinstance(dados_array, dict):
        return dados_array
    if isinstance(dados_array, list):
        for item in dados_array:
            if not isinstance(item, str) or ":" not in item:
                continue
            key, value = item.split(":", 1)
            if key == "dobradicas_alturas":
                dados[key] = [v.strip() for v in value.split(",") if v.strip()]
            else:
                dados[key] = value
    return dados


def _buscar_tabela_supabase(tabela, order=None):
    from app import SUPABASE_URL, HEADERS

    params = {"select": "*"}
    if order:
        params["order"] = order

    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/{tabela}",
        headers=HEADERS,
        params=params,
        timeout=20,
    )
    r.raise_for_status()
    return r.json()


def _buscar_contexto_precificacao(contexto_extra=None):
    contexto_extra = contexto_extra if isinstance(contexto_extra, dict) else {}

    # Carrega dados oficiais do banco. Se a chamada enviar contexto manual,
    # ele pode sobrescrever listas específicas para simulação/teste controlado.
    perfis = contexto_extra.get("perfis") or contexto_extra.get("todosPerfis") or _buscar_tabela_supabase("perfis", "nome.asc")
    vidros = contexto_extra.get("vidros") or contexto_extra.get("todosVidros") or _buscar_tabela_supabase("vidros", "tipo.asc")
    puxadores = contexto_extra.get("puxadores") or contexto_extra.get("todosPuxadores") or _buscar_tabela_supabase("puxadores", "nome.asc")
    sistemas = contexto_extra.get("sistemas") or contexto_extra.get("sistemasLista") or _buscar_tabela_supabase("sistemas", "nome.asc")
    materiais = contexto_extra.get("materiais") or contexto_extra.get("insumos") or contexto_extra.get("todosInsumos") or _buscar_tabela_supabase("materiais", "nome.asc")
    trilhos = contexto_extra.get("trilhos") or contexto_extra.get("todosTrilhos") or _buscar_tabela_supabase("trilhos", "nome.asc")
    tags = contexto_extra.get("tags") or contexto_extra.get("todasTags") or _buscar_tabela_supabase("tags")

    # A tabela trilhos não tem tipo_medida. Para cálculo, trilho é sempre metro linear.
    if isinstance(trilhos, list):
        for trilho in trilhos:
            if isinstance(trilho, dict) and not trilho.get("tipo_medida"):
                trilho["tipo_medida"] = "metro_linear"

    # O engine procura trilhos dentro de "insumos" para reaproveitar a mesma
    # regra de referência/material. Por isso combinamos materiais + trilhos.
    materiais_para_busca = list(materiais or []) + list(trilhos or [])

    return {
        "perfis": perfis,
        "vidros": vidros,
        "puxadores": puxadores,
        "sistemas": sistemas,
        "insumos": materiais_para_busca,
        "materiais": materiais,
        "trilhos": trilhos,
        "tags": tags,
    }


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
            p["dados"] = _dados_array_para_dict(p.get("dados", []))
            p["quantidade"] = int(p.get("quantidade", 1))
        return jsonify({"success": True, "portas": portas})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# POST cálculo oficial de uma porta no backend
@portas_bp.route("/api/orcamento/<orcamento_uuid>/portas/calcular", methods=["POST"])
def calcular_porta_backend(orcamento_uuid):
    try:
        from pricing_engine import calculate_door

        data = request.json or {}
        porta = data.get("porta") or data.get("door") or data
        if not isinstance(porta, dict):
            return jsonify({"success": False, "error": "Formato inválido para porta."}), 400

        porta.setdefault("orcamento_uuid", orcamento_uuid)
        if isinstance(porta.get("dados"), list):
            porta["dados"] = _dados_array_para_dict(porta.get("dados"))

        contexto = _buscar_contexto_precificacao(data.get("contexto"))
        resultado = calculate_door(porta, contexto)
        resultado["orcamento_uuid"] = orcamento_uuid
        return jsonify(resultado)
    except requests.HTTPError as http_err:
        response = http_err.response
        return jsonify({
            "success": False,
            "error": f"{response.status_code} {response.text}"
        }), response.status_code
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
