from flask import Blueprint, request, jsonify
import requests

from auth_utils import buscar_usuario_por_token, extrair_token

clientes_bp = Blueprint("clientes_bp", __name__)

@clientes_bp.route("/api/clientes/cadastro", methods=["POST"])
def cadastrar_cliente():
    from app import SUPABASE_URL, HEADERS

    token = extrair_token(request)
    usuario = None

    if token:
        try:
            usuario = buscar_usuario_por_token(token)
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    data = request.json or {}

    nome = data.get("nome")
    dados = data.get("dados")

    if not nome:
        return jsonify({"success": False, "error": "Nome é obrigatório"}), 400

    if not isinstance(dados, dict):
        return jsonify({"success": False, "error": "Campo 'dados' inválido"}), 400

    campos_obrigatorios = ["cpf_cnpj", "endereco", "cep", "whatsapp", "email"]
    faltando = [c for c in campos_obrigatorios if not dados.get(c)]

    if faltando:
        return jsonify({
            "success": False,
            "error": f"Campos obrigatórios faltando: {', '.join(faltando)}"
        }), 400

    payload = {
        "nome": nome,
        "dados": dados
    }

    # se quiser vincular ao usuário
    if usuario and usuario.get("id"):
        payload["user_id"] = usuario["id"]

    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/clientes",
            headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"},
            json=payload
        )
        r.raise_for_status()

        cliente = r.json()[0]

        return jsonify({
            "success": True,
            "cliente_id": cliente.get("id"),
            "nome": cliente.get("nome")
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
