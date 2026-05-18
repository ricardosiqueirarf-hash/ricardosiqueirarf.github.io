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


def obter_storeid(usuario):
    usuario = usuario or {}
    return (
        usuario.get("storeid")
        or usuario.get("storeID")
        or usuario.get("lojaid")
        or usuario.get("lojaID")
    )


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


def _buscar_orcamento_por_numero(numero_pedido, storeid=None):
    from app import SUPABASE_URL, HEADERS

    filtro_loja = f"&lojaid=eq.{storeid}" if storeid else ""
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/orcamentos?select=id,numero_pedido,cliente_nome,lojaid,valor_total,valor_pago&numero_pedido=eq.{numero_pedido}{filtro_loja}&limit=1",
        headers=HEADERS
    )
    r.raise_for_status()
    itens = r.json() or []
    return itens[0] if itens else None


def _buscar_orcamento_por_id(orcamento_id, storeid=None):
    from app import SUPABASE_URL, HEADERS

    filtro_loja = f"&lojaid=eq.{storeid}" if storeid else ""
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/orcamentos?select=id,numero_pedido,cliente_nome,lojaid,valor_total,valor_pago&id=eq.{orcamento_id}{filtro_loja}&limit=1",
        headers=HEADERS
    )
    r.raise_for_status()
    itens = r.json() or []
    return itens[0] if itens else None


def _atualizar_valor_pago_orcamento(orcamento_id, valor_pago):
    from app import SUPABASE_URL, HEADERS

    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/orcamentos?id=eq.{orcamento_id}",
        headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"},
        json={"valor_pago": valor_pago}
    )
    r.raise_for_status()
    itens = r.json() or []
    return itens[0] if itens else {"id": orcamento_id, "valor_pago": valor_pago}


def _normalizar_registro_pagamento(registro):
    registro = registro or {}
    dados_pagamento = registro.get("pagamentos") or {}
    if isinstance(dados_pagamento, list):
        formas_pagamento = dados_pagamento
        primeiro = formas_pagamento[0] if formas_pagamento else {}
        dados_pagamento = {
            "formas_pagamento": formas_pagamento,
            "valor_pago": sum(_valor_float(item.get("valor")) for item in formas_pagamento),
            "data_pagamento": primeiro.get("data_pagamento"),
            "forma_pagamento": primeiro.get("forma_pagamento") or primeiro.get("forma")
        }

    return {
        "id": registro.get("id"),
        "created_at": registro.get("created_at"),
        "orcamentoid": registro.get("orcamentoid"),
        "orcamento_uuid": registro.get("orcamentoid"),
        "pagamentos": dados_pagamento,
        "numero_pedido": dados_pagamento.get("numero_pedido"),
        "cliente_nome": dados_pagamento.get("cliente_nome"),
        "lojaid": dados_pagamento.get("lojaid"),
        "valor_total": dados_pagamento.get("valor_pago") or dados_pagamento.get("valor_total"),
        "formas_pagamento": dados_pagamento.get("formas_pagamento") or [],
        "forma_pagamento": dados_pagamento.get("forma_pagamento"),
        "data_pagamento": dados_pagamento.get("data_pagamento"),
        "status": dados_pagamento.get("status")
    }


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

    storeid_usuario = obter_storeid(usuario)

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

    storeid = obter_storeid(usuario)

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

    storeid = obter_storeid(usuario)
    if level == 1 and not storeid:
        return jsonify({"success": False, "error": "Loja não vinculada ao usuário."}), 403

    data = request.json or {}
    cliente_nome = (data.get("cliente_nome") or "").strip()
    lojaid_novo = (
        data.get("storeID")
        or data.get("lojaID")
        or data.get("lojaid")
        or data.get("storeid")
    )
    if lojaid_novo is not None:
        lojaid_novo = str(lojaid_novo).strip() or None

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

        payload_patch = {"cliente_nome": cliente_nome}
        if level in (2, 3) and lojaid_novo:
            payload_patch["lojaid"] = lojaid_novo
        elif level == 1 and storeid:
            payload_patch["lojaid"] = storeid

        r_patch = requests.patch(
            f"{SUPABASE_URL}/rest/v1/orcamentos?id=eq.{uuid}",
            headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"},
            json=payload_patch
        )
        r_patch.raise_for_status()
        atualizados = r_patch.json() or []
        item = atualizados[0] if atualizados else {"id": uuid, "cliente_nome": cliente_nome, "status": status_atual_int}

        return jsonify({
            "success": True,
            "id": item.get("id"),
            "cliente_nome": item.get("cliente_nome"),
            "lojaid": item.get("lojaid"),
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

    storeid = obter_storeid(usuario)

    if level == 1 and not storeid:
        return jsonify({"success": False, "error": "Loja não vinculada ao usuário."}), 403

    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/{TABELA_PAGAMENTOS}?select=id,created_at,orcamentoid,pagamentos&order=created_at.desc",
            headers=HEADERS
        )
        r.raise_for_status()
        pagamentos = [_normalizar_registro_pagamento(item) for item in (r.json() or [])]

        if level == 1:
            pagamentos_filtrados = []
            for pagamento in pagamentos:
                if _buscar_orcamento_por_id(pagamento.get("orcamentoid"), storeid):
                    pagamentos_filtrados.append(pagamento)
            pagamentos = pagamentos_filtrados

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

    storeid = obter_storeid(usuario)

    if level == 1 and not storeid:
        return jsonify({"success": False, "error": "Loja não vinculada ao usuário."}), 403

    try:
        if level == 1 and not _buscar_orcamento_por_id(uuid, storeid):
            return jsonify({"success": False, "error": "Pedido não encontrado."}), 404

        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/{TABELA_PAGAMENTOS}?select=id,created_at,orcamentoid,pagamentos&orcamentoid=eq.{uuid}&order=created_at.desc&limit=1",
            headers=HEADERS
        )
        r.raise_for_status()
        itens = r.json() or []
        pagamento = _normalizar_registro_pagamento(itens[0]) if itens else None

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

    storeid = obter_storeid(usuario)

    if level == 1 and not storeid:
        return jsonify({"success": False, "error": "Loja não vinculada ao usuário."}), 403

    data = request.json or {}
    formas_pagamento = _normalizar_pagamentos(data.get("formas_pagamento"))
    status = data.get("status", "pendente")

    if not isinstance(formas_pagamento, list) or len(formas_pagamento) == 0:
        return jsonify({"success": False, "error": "Formas de pagamento inválidas."}), 400

    try:
        orcamento = _buscar_orcamento_por_id(uuid, storeid if level == 1 else None)
        if not orcamento:
            return jsonify({"success": False, "error": "Pedido não encontrado."}), 404

        valor_total = sum(_valor_float(item.get("valor")) for item in formas_pagamento)
        dados_pagamento = {
            "numero_pedido": data.get("numero_pedido") or orcamento.get("numero_pedido"),
            "cliente_nome": data.get("cliente_nome") or orcamento.get("cliente_nome"),
            "lojaid": data.get("lojaid") or orcamento.get("lojaid") or storeid,
            "valor_total": valor_total,
            "valor_pago": valor_total,
            "formas_pagamento": formas_pagamento,
            "status": status
        }

        payload = {
            "orcamentoid": uuid,
            "pagamentos": dados_pagamento
        }

        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/{TABELA_PAGAMENTOS}",
            headers={
                **HEADERS,
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            },
            json=payload
        )
        r.raise_for_status()
        itens = r.json() or []
        pagamento = _normalizar_registro_pagamento(itens[0]) if itens else _normalizar_registro_pagamento(payload)

        return jsonify({"success": True, "pagamento": pagamento})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@orcamentos_bp.route("/api/pagamentos", methods=["POST"])
def adicionar_pagamento():
    from app import SUPABASE_URL, HEADERS

    token, usuario = _usuario_por_request()

    try:
        level = int((usuario or {}).get("level") or 0)
    except (TypeError, ValueError):
        level = 0

    storeid = obter_storeid(usuario)

    if level == 1 and not storeid:
        return jsonify({"success": False, "error": "Loja não vinculada ao usuário."}), 403

    data = request.json or {}
        if "pagamentos" in data and ("numero_pedido" in data or "orcamentoid" in data):
        pagamentos = data.get("pagamentos")
        created_at = (data.get("created_at") or "").strip()
        orcamentoid = (data.get("orcamentoid") or "").strip()
        numero_pedido = data.get("numero_pedido")

        if not isinstance(pagamentos, (dict, list)):
            return jsonify({"success": False, "error": "pagamentos deve ser um JSON válido (objeto ou lista)."}), 400

        try:
            if orcamentoid:
                orcamento = _buscar_orcamento_por_id(orcamentoid, storeid if level == 1 else None)
            else:
                try:
                    numero_pedido = int(numero_pedido)
                except (TypeError, ValueError):
                    return jsonify({"success": False, "error": "Número do pedido inválido."}), 400
                orcamento = _buscar_orcamento_por_numero(numero_pedido, storeid if level == 1 else None)

            if not orcamento:
                return jsonify({"success": False, "error": "Pedido não encontrado."}), 404

            orcamentoid_final = orcamento.get("id") or orcamentoid
            if isinstance(pagamentos, dict):
                pagamentos_payload = {
                    **pagamentos,
                    "numero_pedido": pagamentos.get("numero_pedido") or orcamento.get("numero_pedido"),
                    "cliente_nome": pagamentos.get("cliente_nome") or orcamento.get("cliente_nome"),
                    "lojaid": pagamentos.get("lojaid") or orcamento.get("lojaid") or storeid
                }
            else:
                pagamentos_payload = pagamentos

            payload = {
                "orcamentoid": orcamentoid_final,
                "pagamentos": pagamentos_payload
            }
            if created_at:
                payload["created_at"] = created_at

            r = requests.post(
                f"{SUPABASE_URL}/rest/v1/{TABELA_PAGAMENTOS}",
                headers={
                    **HEADERS,
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                json=payload
            )
            r.raise_for_status()
            itens = r.json() or []
            pagamento = _normalizar_registro_pagamento(itens[0]) if itens else _normalizar_registro_pagamento(payload)

            valor_pago_json = pagamentos_payload.get("valor_pago") if isinstance(pagamentos_payload, dict) else None
            orcamento_atualizado = None
            if valor_pago_json is not None:
                try:
                    valor_pago_float = float(valor_pago_json)
                    if valor_pago_float >= 0:
                        orcamento_atualizado = _atualizar_valor_pago_orcamento(orcamentoid_final, valor_pago_float)
                except (TypeError, ValueError):
                    orcamento_atualizado = None

            return jsonify({
                "success": True,
                "message": "Pagamento adicionado. O UUID foi buscado na tabela orcamentos pelo número do pedido.",
                "pagamento": pagamento,
                "orcamento": orcamento_atualizado,
                "orcamentoid": orcamentoid_final
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
            
    if "orcamentoid" in data and "pagamentos" in data:
        orcamentoid = (data.get("orcamentoid") or "").strip()
        pagamentos = data.get("pagamentos")
        created_at = (data.get("created_at") or "").strip()

        if not orcamentoid:
            return jsonify({"success": False, "error": "orcamentoid não informado."}), 400

        if not isinstance(pagamentos, (dict, list)):
            return jsonify({"success": False, "error": "pagamentos deve ser um JSON válido (objeto ou lista)."}), 400

        try:
            orcamento = _buscar_orcamento_por_id(orcamentoid, storeid if level == 1 else None)
            if not orcamento:
                return jsonify({"success": False, "error": "Pedido não encontrado."}), 404

            payload = {
                "orcamentoid": orcamentoid,
                "pagamentos": pagamentos
            }
            if created_at:
                payload["created_at"] = created_at

            r = requests.post(
                f"{SUPABASE_URL}/rest/v1/{TABELA_PAGAMENTOS}",
                headers={
                    **HEADERS,
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                json=payload
            )
            r.raise_for_status()
            itens = r.json() or []
            pagamento = _normalizar_registro_pagamento(itens[0]) if itens else _normalizar_registro_pagamento(payload)

            valor_pago_json = pagamentos.get("valor_pago") if isinstance(pagamentos, dict) else None
            orcamento_atualizado = None
            if valor_pago_json is not None:
                try:
                    valor_pago_float = float(valor_pago_json)
                    if valor_pago_float >= 0:
                        orcamento_atualizado = _atualizar_valor_pago_orcamento(orcamentoid, valor_pago_float)
                except (TypeError, ValueError):
                    orcamento_atualizado = None

            return jsonify({
                "success": True,
                "message": "Pagamento adicionado conforme colunas orcamentoid e pagamentos jsonb.",
                "pagamento": pagamento,
                "orcamento": orcamento_atualizado
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    numero_pedido = data.get("numero_pedido")
    valor_pago = data.get("valor_pago")
    data_pagamento = (data.get("data_pagamento") or "").strip()
    forma_pagamento = (data.get("forma_pagamento") or "").strip().lower()
    formas_validas = {"pix", "cartao_credito", "dinheiro"}

    try:
        numero_pedido = int(numero_pedido)
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Número do pedido inválido."}), 400

    try:
        valor_pago = float(valor_pago)
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Valor pago inválido."}), 400

    if valor_pago < 0:
        return jsonify({"success": False, "error": "Valor pago não pode ser negativo."}), 400

    if not data_pagamento:
        return jsonify({"success": False, "error": "Data do pagamento não informada."}), 400

    if forma_pagamento not in formas_validas:
        return jsonify({"success": False, "error": "Forma de pagamento inválida."}), 400

    try:
        orcamento = _buscar_orcamento_por_numero(numero_pedido, storeid if level == 1 else None)
        if not orcamento:
            return jsonify({"success": False, "error": "Pedido não encontrado."}), 404

        orcamento_atualizado = _atualizar_valor_pago_orcamento(orcamento["id"], valor_pago)

        dados_pagamento = {
            "numero_pedido": numero_pedido,
            "cliente_nome": orcamento.get("cliente_nome"),
            "lojaid": orcamento.get("lojaid") or storeid,
            "valor_pago": valor_pago,
            "data_pagamento": data_pagamento,
            "forma_pagamento": forma_pagamento,
            "status": "pago"
        }

        payload = {
            "orcamentoid": orcamento["id"],
            "pagamentos": dados_pagamento
        }

        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/{TABELA_PAGAMENTOS}",
            headers={
                **HEADERS,
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            },
            json=payload
        )
        r.raise_for_status()
        itens = r.json() or []
        pagamento = _normalizar_registro_pagamento(itens[0]) if itens else _normalizar_registro_pagamento(payload)

        return jsonify({
            "success": True,
            "message": "Pagamento adicionado e valor_pago atualizado em orcamentos.",
            "pagamento": pagamento,
            "orcamento": orcamento_atualizado,
            "valor_pago": valor_pago
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@orcamentos_bp.route("/api/orcamento/<uuid>/valor-pago", methods=["POST"])
def atualizar_valor_pago(uuid):
    token, usuario = _usuario_por_request()

    try:
        level = int((usuario or {}).get("level") or 0)
    except (TypeError, ValueError):
        level = 0

    storeid = obter_storeid(usuario)

    if level == 1 and not storeid:
        return jsonify({"success": False, "error": "Loja não vinculada ao usuário."}), 403

    data = request.json or {}

    try:
        valor_pago = float(data.get("valor_pago"))
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Valor pago inválido."}), 400

    if valor_pago < 0:
        return jsonify({"success": False, "error": "Valor pago não pode ser negativo."}), 400

    try:
        from app import SUPABASE_URL, HEADERS

        filtro_loja = f"&lojaid=eq.{storeid}" if level == 1 else ""
        r_check = requests.get(
            f"{SUPABASE_URL}/rest/v1/orcamentos?select=id&id=eq.{uuid}{filtro_loja}&limit=1",
            headers=HEADERS
        )
        r_check.raise_for_status()
        if not (r_check.json() or []):
            return jsonify({"success": False, "error": "Pedido não encontrado."}), 404

        orcamento = _atualizar_valor_pago_orcamento(uuid, valor_pago)
        return jsonify({
            "success": True,
            "message": "Valor pago atualizado em orcamentos.",
            "orcamento": orcamento,
            "valor_pago": valor_pago
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
