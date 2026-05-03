from flask import Blueprint, request, jsonify
import requests
import os

from auth_utils import buscar_usuario_por_token, extrair_token

orcamentos_bp = Blueprint("orcamentos_bp", __name__) 

# =====================
# API ORÇAMENTOS (apenas STATUS)
# =====================
STATUS_VALIDOS = {0, 1, 2, 3, 4, 5}

# ✅ Mapa de tradução do status (backend)
STATUS_LABELS = {
    0: "Cancelado",
    1: "Orçamento",
    2: "Aprovado",
    3: "Em Produção",
    4: "Separado",
    5: "Entregue",
}

TABELA_PAGAMENTOS = os.getenv("SUPABASE_TABLE_PAGAMENTOS", "pagamentos")


def status_label(valor):
    """Converte status numérico em texto amigável."""
    try:
        v = int(valor)
    except (TypeError, ValueError):
        return "Desconhecido"
    return STATUS_LABELS.get(v, "Desconhecido")


def _usuario_por_request():
    token = extrair_token(request)
    usuario = None
    if token:
        try:
            usuario = buscar_usuario_por_token(token)
        except Exception as e:
            raise RuntimeError(str(e))
    return token, (usuario or {})


def _normalizar_pagamentos(raw):
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        itens = raw.get("itens")
        if isinstance(itens, list):
            return itens
    return []


def _valor_float(valor):
    try:
        return float(valor)
    except (TypeError, ValueError):
        return 0.0


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

    storeid_usuario = (usuario or {}).get("storeid")

    data = request.json or {}
    cliente_nome = data.get("cliente_nome")

    # Se quiser permitir criar com UUID fixo (ex: vindo do front)
    orcamento_uuid = (data.get("uuid") or "").strip() or None

    # STATUS inicial
    status_inicial = data.get("status", 1)
    try:
        status_inicial = int(status_inicial)
    except (TypeError, ValueError):
        status_inicial = 1

    if status_inicial not in STATUS_VALIDOS:
        status_inicial = 1

    if not cliente_nome:
        return jsonify({"success": False, "error": "Cliente não informado"}), 400

    storeid_payload = data.get("storeID") or data.get("lojaID") or data.get("lojaid")
    lojaid_final = storeid_usuario or storeid_payload

    if level == 1 and not lojaid_final:
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

        if lojaid_final:
            payload["lojaid"] = lojaid_final

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
            "status_label": status_label(status_inicial),  # ✅ traduzido no backend
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

        # ✅ injeta status_label em cada item
        for o in orcamentos:
            o["status_label"] = status_label(o.get("status"))

        return jsonify({"success": True, "orcamentos": orcamentos})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@orcamentos_bp.route("/api/orcamento/<uuid>/cliente", methods=["PATCH"])
def atualizar_cliente_orcamento(uuid):
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

    data = request.json or {}
    cliente_nome = (data.get("cliente_nome") or "").strip()
    if not cliente_nome:
        return jsonify({"success": False, "error": "Cliente não informado"}), 400

    try:
        filtro_loja = ""
        if level == 1:
            filtro_loja = f"&lojaid=eq.{storeid}"

        r_orc = requests.get(
            f"{SUPABASE_URL}/rest/v1/orcamentos?select=id,status,cliente_nome,lojaid&id=eq.{uuid}{filtro_loja}&limit=1",
            headers=HEADERS
        )
        r_orc.raise_for_status()
        itens = r_orc.json() or []
        if not itens:
            return jsonify({"success": False, "error": "Orçamento não encontrado."}), 404

        atual = itens[0]
        status_atual = atual.get("status")

        try:
            status_atual_int = int(status_atual)
        except (TypeError, ValueError):
            status_atual_int = None

        if status_atual_int != 1:
            return jsonify({
                "success": False,
                "error": "Nome do cliente só pode ser alterado com status 1 (Orçamento).",
                "status": status_atual,
                "status_label": status_label(status_atual)
            }), 409

        r_patch = requests.patch(
            f"{SUPABASE_URL}/rest/v1/orcamentos?id=eq.{uuid}",
            headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"},
            json={"cliente_nome": cliente_nome}
        )
        r_patch.raise_for_status()
        atualizados = r_patch.json() or []
        item = atualizados[0] if atualizados else {"id": uuid, "cliente_nome": cliente_nome, "status": status_atual_int}

        return jsonify({
            "success": True,
            "id": item.get("id"),
            "cliente_nome": item.get("cliente_nome"),
            "status": item.get("status"),
            "status_label": status_label(item.get("status"))
        })
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
# ATUALIZAR STATUS DO ORÇAMENTO
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
        return jsonify({"success": False, "error": "Apenas ADMIN pode cancelar pedidos."}), 403

    try:
        # Buscar status atual direto em orcamentos
        r_atual = requests.get(
            f"{SUPABASE_URL}/rest/v1/orcamentos?select=status&id=eq.{uuid}&limit=1",
            headers=HEADERS
        )
        r_atual.raise_for_status()
        atual_data = r_atual.json()

        if not atual_data:
            return jsonify({"success": False, "error": "Orçamento não encontrado"}), 404

        status_atual = int(atual_data[0].get("status", 1))

        # Regras de transição:
        # 1 -> 2 (Aprovar)
        # 2 -> 3 (Produção)
        # 3 -> 4 (Separado)
        # 4 -> 5 (Entregue)
        # 0 só ADMIN
        permitidos = {
            1: {2},
            2: {3},
            3: {4},
            4: {5},
            5: set(),
            0: set()
        }

        if novo_status == status_atual:
            return jsonify({
                "success": True,
                "message": "Status já está atualizado.",
                "status": status_atual,
                "status_label": status_label(status_atual)
            })

        if novo_status != 0 and novo_status not in permitidos.get(status_atual, set()):
            return jsonify({
                "success": False,
                "error": f"Transição inválida: {status_atual} -> {novo_status}"
            }), 400

        payload = {"status": novo_status}
        r_patch = requests.patch(
            f"{SUPABASE_URL}/rest/v1/orcamentos?id=eq.{uuid}",
            headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"},
            json=payload
        )
        r_patch.raise_for_status()

        return jsonify({
            "success": True,
            "message": "Status atualizado com sucesso",
            "status": novo_status,
            "status_label": status_label(novo_status)
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@orcamentos_bp.route("/api/pagamentos", methods=["GET"])
def listar_pagamentos():
    from app import SUPABASE_URL, HEADERS

    token, usuario = _usuario_por_request()

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
            f"{SUPABASE_URL}/rest/v1/{TABELA_PAGAMENTOS}?select=id,orcamento_uuid,numero_pedido,cliente_nome,lojaid,valor_total,formas_pagamento,data_criacao,data_pagamento,status&order=data_criacao.desc{filtro_loja}",
            headers=HEADERS
        )
        r.raise_for_status()
        pagamentos = r.json() or []

        return jsonify({"success": True, "pagamentos": pagamentos})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@orcamentos_bp.route("/api/orcamento/<uuid>/pagamentos", methods=["GET"])
def obter_pagamentos_orcamento(uuid):
    from app import SUPABASE_URL, HEADERS

    token, usuario = _usuario_por_request()

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
            f"{SUPABASE_URL}/rest/v1/{TABELA_PAGAMENTOS}?select=id,orcamento_uuid,numero_pedido,cliente_nome,lojaid,valor_total,formas_pagamento,data_criacao,data_pagamento,status&orcamento_uuid=eq.{uuid}{filtro_loja}&limit=1",
            headers=HEADERS
        )
        r.raise_for_status()
        itens = r.json() or []
        pagamento = itens[0] if itens else None

        return jsonify({"success": True, "pagamento": pagamento})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@orcamentos_bp.route("/api/orcamento/<uuid>/pagamentos", methods=["POST"])
def salvar_pagamentos_orcamento(uuid):
    from app import SUPABASE_URL, HEADERS

    token, usuario = _usuario_por_request()

    try:
        level = int((usuario or {}).get("level") or 0)
    except (TypeError, ValueError):
        level = 0

    storeid = (usuario or {}).get("storeid")

    if level == 1 and not storeid:
        return jsonify({"success": False, "error": "Loja não vinculada ao usuário."}), 403

    data = request.json or {}
    numero_pedido = data.get("numero_pedido")
    cliente_nome = data.get("cliente_nome")
    lojaid = data.get("lojaid") or storeid
    formas_pagamento = _normalizar_pagamentos(data.get("formas_pagamento"))
    status = data.get("status", "pendente")

    if not isinstance(formas_pagamento, list) or len(formas_pagamento) == 0:
        return jsonify({"success": False, "error": "Formas de pagamento inválidas."}), 400

    valor_total = sum(_valor_float(item.get("valor")) for item in formas_pagamento)

    payload = {
        "orcamento_uuid": uuid,
        "numero_pedido": numero_pedido,
        "cliente_nome": cliente_nome,
        "lojaid": lojaid,
        "valor_total": valor_total,
        "formas_pagamento": formas_pagamento,
        "status": status
    }

    try:
        # upsert por orcamento_uuid
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/{TABELA_PAGAMENTOS}",
            headers={
                **HEADERS,
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=representation"
            },
            json=payload
        )
        r.raise_for_status()
        itens = r.json() or []
        pagamento = itens[0] if itens else payload

        return jsonify({"success": True, "pagamento": pagamento})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
