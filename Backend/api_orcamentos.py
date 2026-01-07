from flask import Blueprint, request, jsonify
import requests

from auth_utils import buscar_usuario_por_token, extrair_token

orcamentos_bp = Blueprint("orcamentos_bp", __name__)

# =====================
# API ORÇAMENTOS
# =====================
ESTADOS_VALIDOS = {0, 1, 2, 3, 4, 5}


def buscar_estado_orcamento(uuid, supabase_url, headers):
    r_estado = requests.get(
        f"{supabase_url}/rest/v1/estados?uuid=eq.{uuid}&select=estado&limit=1",
        headers=headers,
    )
    r_estado.raise_for_status()
    estados = r_estado.json()
    if not estados:
        return None
    return estados[0].get("estado")


def atualizar_estado_orcamento(uuid, novo_estado, supabase_url, headers):
    r_patch = requests.patch(
        f"{supabase_url}/rest/v1/estados?uuid=eq.{uuid}",
        headers={**headers, "Content-Type": "application/json", "Prefer": "return=representation"},
        json={"estado": novo_estado},
    )
    r_patch.raise_for_status()
    return r_patch.json()

@orcamentos_bp.route("/api/orcamento", methods=["POST"])
def criar_orcamento():
    from app import SUPABASE_URL, HEADERS
    token = extrair_token(request)

    usuario = None
    if token:
        try:
            usuario = buscar_usuario_por_token(token)
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    try:
        level = int((usuario or {}).get("level") or 0)
    except (TypeError, ValueError):
        level = 0
    storeid = (usuario or {}).get("storeid")

    data = request.json
    cliente_nome = data.get("cliente_nome")
    if not cliente_nome:
        return jsonify({"success": False, "error": "Cliente não informado"}), 400
    if level == 1 and not storeid:
        return jsonify({"success": False, "error": "Loja não vinculada ao usuário."}), 403

    try:
        # Pegar último numero_pedido
        r_last = requests.get(
            f"{SUPABASE_URL}/rest/v1/orcamentos?select=numero_pedido&order=numero_pedido.desc&limit=1",
            headers=HEADERS
        )
        r_last.raise_for_status()
        last_pedido = r_last.json()
        numero_pedido = (last_pedido[0]['numero_pedido'] + 1) if last_pedido else 1

        payload = {
            "cliente_nome": cliente_nome,
            "numero_pedido": numero_pedido,
            "quantidade_total": 0,
            "valor_total": 0
        }
        if level == 1:
            payload["lojaid"] = storeid

        r_post = requests.post(
            f"{SUPABASE_URL}/rest/v1/orcamentos",
            headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"},
            json=payload
        )
        r_post.raise_for_status()
        new_orcamento = r_post.json()

        r_estado = requests.post(
            f"{SUPABASE_URL}/rest/v1/estados",
            headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"},
            json={"uuid": new_orcamento[0]["id"], "estado": 1},
        )
        r_estado.raise_for_status()

        return jsonify({
            "success": True,
            "id": new_orcamento[0]['id'],
            "numero_pedido": numero_pedido,
            "cliente_nome": cliente_nome
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@orcamentos_bp.route("/api/orcamentos", methods=["GET"])
def listar_orcamentos():
    from app import SUPABASE_URL, HEADERS
    token = extrair_token(request)

    usuario = None
    if token:
        try:
            usuario = buscar_usuario_por_token(token)
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    try:
        level = int((usuario or {}).get("level") or 0)
    except (TypeError, ValueError):
        level = 0
    storeid = (usuario or {}).get("storeid")
    if level == 1 and not storeid:
        return jsonify({"success": False, "error": "Loja não vinculada ao usuário."}), 403

    filtro_loja = ""
    if level == 1:
        filtro_loja = f"&lojaid=eq.{storeid}"
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/orcamentos?select=id,numero_pedido,cliente_nome,data_criacao,quantidade_total,valor_total,lojaid&order=numero_pedido.asc{filtro_loja}",
            headers=HEADERS
        )
        r.raise_for_status()
        return jsonify({"success": True, "orcamentos": r.json()})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# =====================
# FINALIZAR ORÇAMENTO (salva total de portas)
# =====================
@orcamentos_bp.route("/api/orcamento/<uuid>/finalizar", methods=["POST"])
def finalizar_orcamento(uuid):
    from app import SUPABASE_URL, HEADERS
    data = request.json
    portas = data.get("portas", [])
    if not portas:
        return jsonify({"success": False, "error": "Nenhuma porta enviada"}), 400

    # calcular totais
    quantidade_total = sum(p.get("quantidade", 1) for p in portas)
    valor_total = sum(p.get("preco", 0) for p in portas)

    try:
        payload = {
            "quantidade_total": quantidade_total,
            "valor_total": valor_total
        }
        r_patch = requests.patch(
            f"{SUPABASE_URL}/rest/v1/orcamentos?id=eq.{uuid}",
            headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"},
            json=payload
        )
        r_patch.raise_for_status()
        return jsonify({"success": True, "quantidade_total": quantidade_total, "valor_total": valor_total})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@orcamentos_bp.route("/api/orcamento/<uuid>/estado", methods=["POST"])
def atualizar_estado(uuid):
    from app import SUPABASE_URL, HEADERS
    token = extrair_token(request)

    usuario = None
    if token:
        try:
            usuario = buscar_usuario_por_token(token)
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    try:
        level = int((usuario or {}).get("level") or 0)
    except (TypeError, ValueError):
        level = 0

    data = request.json or {}
    novo_estado = data.get("estado")
    try:
        novo_estado = int(novo_estado)
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Estado inválido"}), 400

    if novo_estado not in ESTADOS_VALIDOS:
        return jsonify({"success": False, "error": "Estado inválido"}), 400

    if novo_estado == 0 and level != 3:
        return jsonify({"success": False, "error": "Apenas ADM pode cancelar orçamentos."}), 403

    try:
        estado_atual = buscar_estado_orcamento(uuid, SUPABASE_URL, HEADERS)
        if estado_atual is None:
            return jsonify({"success": False, "error": "Estado não encontrado para o orçamento."}), 404

        if novo_estado == 2:
            if int(estado_atual) != 1:
                return jsonify({"success": False, "error": "Orçamento não está no estado de orçamento."}), 400

            nome = data.get("nome")
            email = data.get("email")
            celular = data.get("celular")
            cpf_cnpj = data.get("cpf_cnpj")
            faltando = [campo for campo, valor in {
                "nome": nome,
                "email": email,
                "celular": celular,
                "cpf_cnpj": cpf_cnpj,
            }.items() if not valor]
            if faltando:
                return jsonify({"success": False, "error": f"Campos obrigatórios faltando: {', '.join(faltando)}"}), 400

            r_cliente = requests.post(
                f"{SUPABASE_URL}/rest/v1/clientes",
                headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"},
                json={
                    "nome": nome,
                    "dados": [{"email": email, "celular": celular, "cpf_cnpj": cpf_cnpj}],
                },
            )
            r_cliente.raise_for_status()

        atualizado = atualizar_estado_orcamento(uuid, novo_estado, SUPABASE_URL, HEADERS)
        return jsonify({"success": True, "estado": novo_estado, "registro": atualizado})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500






