from flask import Blueprint, request, jsonify
import requests

from auth_utils import buscar_usuario_por_token, extrair_token

orcamentos_bp = Blueprint("orcamentos_bp", __name__)

# =====================
# API ORÇAMENTOS (apenas STATUS)
# =====================
STATUS_VALIDOS = {0, 1, 2, 3, 4, 5}


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

    data = request.json or {}
    cliente_nome = data.get("cliente_nome")

    # Se quiser permitir criar com UUID fixo (ex: vindo do front)
    orcamento_uuid = (data.get("uuid") or "").strip() or None

    # STATUS inicial (substitui totalmente o "estado")
    status_inicial = data.get("status", 1)
    try:
        status_inicial = int(status_inicial)
    except (TypeError, ValueError):
        status_inicial = 1

    if status_inicial not in STATUS_VALIDOS:
        status_inicial = 1

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
        numero_pedido = (last_pedido[0]["numero_pedido"] + 1) if last_pedido else 1

        payload = {
            "cliente_nome": cliente_nome,
            "numero_pedido": numero_pedido,
            "quantidade_total": 0,
            "status": status_inicial,
            "valor_total": 0
        }

        if orcamento_uuid:
            payload["id"] = orcamento_uuid

        if level == 1:
            payload["lojaid"] = storeid

        r_post = requests.post(
            f"{SUPABASE_URL}/rest/v1/orcamentos",
            headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"},
            json=payload
        )
        r_post.raise_for_status()
        new_orcamento = r_post.json()

        orcamento_id = new_orcamento[0]["id"]

        return jsonify({
            "success": True,
            "id": orcamento_id,
            "uuid": orcamento_id,
            "numero_pedido": numero_pedido,
            "status": status_inicial,
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
            f"{SUPABASE_URL}/rest/v1/orcamentos?select=id,numero_pedido,cliente_nome,data_criacao,quantidade_total,status,valor_total,lojaid&order=numero_pedido.asc{filtro_loja}",
            headers=HEADERS
        )
        r.raise_for_status()
        orcamentos = r.json()

        return jsonify({"success": True, "orcamentos": orcamentos})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# =====================
# FINALIZAR ORÇAMENTO (salva total de portas)
# =====================
@orcamentos_bp.route("/api/orcamento/<uuid>/finalizar", methods=["POST"])
def finalizar_orcamento(uuid):
    from app import SUPABASE_URL, HEADERS
    data = request.json or {}
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


# =====================
# ATUALIZAR STATUS DO ORÇAMENTO (substitui /estado)
# =====================
@orcamentos_bp.route("/api/orcamento/<uuid>/status", methods=["POST"])
def atualizar_status(uuid):
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
    novo_status = data.get("status")

    try:
        novo_status = int(novo_status)
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Status inválido"}), 400

    if novo_status not in STATUS_VALIDOS:
        return jsonify({"success": False, "error": "Status inválido"}), 400

    # Cancelamento (status 0) só ADM
    if novo_status == 0 and level != 3:
        return jsonify({"success": False, "error": "Apenas ADM pode cancelar orçamentos."}), 403

    try:
        # Buscar status atual direto em orcamentos
        r_atual = requests.get(
            f"{SUPABASE_URL}/rest/v1/orcamentos?select=status&id=eq.{uuid}&limit=1",
            headers=HEADERS
        )
        r_atual.raise_for_status()
        atual = r_atual.json()

        if not atual:
            return jsonify({"success": False, "error": "Orçamento não encontrado."}), 404

        status_atual = atual[0].get("status")

        # Regra: só pode ir para status 2 se estiver em 1 (mesma lógica que você tinha)
        if novo_status == 2:
            try:
                if int(status_atual) != 1:
                    return jsonify({"success": False, "error": "Orçamento não está no status de orçamento."}), 400
            except (TypeError, ValueError):
                return jsonify({"success": False, "error": "Status atual inválido."}), 400

            # Exigir dados do cliente (seu comportamento original)
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

        # Atualiza status no próprio orçamento
        r_patch = requests.patch(
            f"{SUPABASE_URL}/rest/v1/orcamentos?id=eq.{uuid}",
            headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"},
            json={"status": novo_status},
        )
        r_patch.raise_for_status()
        atualizado = r_patch.json()

        return jsonify({"success": True, "status": novo_status, "registro": atualizado})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
