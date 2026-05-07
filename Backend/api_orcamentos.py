def _filtro_loja_usuario(usuario):
    try:
        level = int((usuario or {}).get("level") or 0)
    except (TypeError, ValueError):
        level = 0

    storeid = obter_storeid(usuario)

    if level == 1 and not storeid:
        return None, jsonify({"success": False, "error": "Loja não vinculada ao usuário."}), 403

    filtro_loja = f"&lojaid=eq.{storeid}" if level == 1 else ""
    return filtro_loja, None, None


@orcamentos_bp.route("/api/orcamento/<uuid>/valor-pago", methods=["GET"])
def obter_valor_pago_orcamento(uuid):
    from app import SUPABASE_URL, HEADERS

    try:
        token, usuario = _usuario_por_request()
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

    filtro_loja, erro, status_code = _filtro_loja_usuario(usuario)
    if erro:
        return erro, status_code

    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/orcamentos?select=id,valor_pago&id=eq.{uuid}{filtro_loja}&limit=1",
            headers=HEADERS
        )
        r.raise_for_status()
        itens = r.json() or []

        if not itens:
            return jsonify({"success": False, "error": "Orçamento não encontrado"}), 404

        return jsonify({
            "success": True,
            "uuid": itens[0].get("id"),
            "valor_pago": itens[0].get("valor_pago")
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
