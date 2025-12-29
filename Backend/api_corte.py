from flask import Blueprint, request, jsonify

corte_bp = Blueprint("corte_bp", __name__)

# Exemplo simples de preços por tipo de vidro e insumos
PRECO_VIDRO = {
    "comum": 120,       # R$/m²
    "temperado": 200,
    "laminado": 250
}

@corte_bp.route("/api/cortevidro", methods=["POST"])
def calcular_corte():
    try:
        data = request.json
        largura = float(data.get("largura", 0)) / 1000  # converter mm para m
        altura = float(data.get("altura", 0)) / 1000
        espessura = float(data.get("espessura", 0))
        tipoVidro = data.get("tipoVidro", "comum")
        perda = float(data.get("perda", 0))

        if largura <= 0 or altura <= 0 or espessura <= 0:
            return jsonify({"success": False, "error":"Dimensões inválidas"}), 400

        area = largura * altura
        areaLiquida = area * (1 + perda/100)
        preco_m2 = PRECO_VIDRO.get(tipoVidro, 120)
        custo = areaLiquida * preco_m2

        return jsonify({
            "success": True,
            "largura": largura,
            "altura": altura,
            "espessura": espessura,
            "tipoVidro": tipoVidro,
            "perda": perda,
            "areaLiquida": areaLiquida,
            "custo": custo
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
