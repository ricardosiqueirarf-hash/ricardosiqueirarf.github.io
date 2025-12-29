from flask import Blueprint, request, jsonify

corte_bp = Blueprint("corte_bp", __name__)

CHAPA_LARGURA = 2400  # mm
CHAPA_ALTURA = 3210   # mm

# Preço por tipo de vidro (R$/m²)
PRECO_VIDRO = {
    "comum": 120,
    "temperado": 200,
    "laminado": 250
}

@corte_bp.route("/api/cortevidro", methods=["POST"])
def calcular_corte():
    try:
        data = request.json
        pecas = data.get("pecas", [])
        if not pecas:
            return jsonify({"success": False, "error": "Nenhuma peça enviada"}), 400

        distribucao = []
        y_atual = 0
        linha_altura = 0
        x_atual = 0
        custo_total = 0
        detalhes_pecas = []

        for p in pecas:
            largura = float(p.get("largura",0))
            altura = float(p.get("altura",0))
            espessura = float(p.get("espessura",0))
            tipoVidro = p.get("tipoVidro","comum")
            perda = float(p.get("perda",0))
            quantidade = int(p.get("quantidade",1))

            if largura <=0 or altura<=0 or espessura<=0:
                return jsonify({"success": False, "error": "Dimensões inválidas em alguma peça"}), 400

            area_m2 = (largura/1000) * (altura/1000)  # m²
            area_liquida = area_m2 * (1 + perda/100)
            custo = area_liquida * PRECO_VIDRO.get(tipoVidro,120) * quantidade
            custo_total += custo

            for q in range(quantidade):
                # Se a peça não cabe na linha, quebra para a próxima linha
                if x_atual + largura > CHAPA_LARGURA:
                    x_atual = 0
                    y_atual += linha_altura
                    linha_altura = 0

                # Se a peça ultrapassa a chapa vertical, não cabe
                if y_atual + altura > CHAPA_ALTURA:
                    return jsonify({"success": False, "error": "Peça não cabe na chapa"}), 400

                distribucao.append({
                    "x": x_atual,
                    "y": y_atual,
                    "largura": largura,
                    "altura": altura,
                    "espessura": espessura,
                    "tipoVidro": tipoVidro,
                    "perda": perda,
                    "custo": custo/quantidade
                })

                x_atual += largura
                linha_altura = max(linha_altura, altura)

            detalhes_pecas.append({
                "largura": largura,
                "altura": altura,
                "espessura": espessura,
                "tipoVidro": tipoVidro,
                "perda": perda,
                "quantidade": quantidade,
                "custo_total": custo
            })

        return jsonify({
            "success": True,
            "custo_total": custo_total,
            "pecas": detalhes_pecas,
            "distribuicao": distribucao,
            "chapa_largura": CHAPA_LARGURA,
            "chapa_altura": CHAPA_ALTURA
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

