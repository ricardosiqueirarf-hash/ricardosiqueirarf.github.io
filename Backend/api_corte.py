from flask import Blueprint, request, jsonify
from rectpack import newPacker

corte_bp = Blueprint("corte_bp", __name__)

# Tamanho da chapa padrão (mm)
CHAPA_LARGURA = 2400
CHAPA_ALTURA = 3210

# Preços exemplo (R$/m²)
PRECO_VIDRO = {
    "comum": 120,
    "temperado": 200,
    "laminado": 250
}

# Insumos padrão (R$ por unidade)
INSUMOS = {
    "puxador": 15,
    "dobradiça": 5,
    "trilho": 20
}

@corte_bp.route("/api/cortevidro", methods=["POST"])
def calcular_corte():
    try:
        data = request.json
        pecas = data.get("pecas", [])
        if not pecas:
            return jsonify({"success": False, "error": "Nenhuma peça enviada"}), 400

        # Preparar retângulos para o bin packer
        rectangles = []
        pecas_info = []
        for idx, p in enumerate(pecas):
            largura = float(p.get("largura",0))
            altura = float(p.get("altura",0))
            quantidade = int(p.get("quantidade",1))
            tipo_vidro = p.get("tipoVidro","comum")
            insumos = p.get("insumos",{})

            if largura <=0 or altura <=0:
                return jsonify({"success": False, "error": f"Dimensões inválidas para peça {idx}"}), 400

            for _ in range(quantidade):
                rectangles.append((largura, altura, idx))
            
            pecas_info.append({
                "largura": largura,
                "altura": altura,
                "tipo_vidro": tipo_vidro,
                "insumos": insumos
            })

        # Criar packer
        packer = newPacker(rotation=False)
        packer.add_bin(CHAPA_LARGURA, CHAPA_ALTURA)
        for r in rectangles:
            packer.add_rect(r[0], r[1], r[2])
        packer.pack()

        resultado = []
        custo_total = 0
        area_total_pecas = sum((p["largura"]/1000)*(p["altura"]/1000)*int(p.get("quantidade",1)) for p in pecas)
        area_chapa_usada = 0

        # Agora pegamos os objetos Rectangle do rectpack
        for abin in packer:
            for rect in abin:
                x = rect.x
                y = rect.y
                w = rect.width
                h = rect.height
                idx = rect.rid  # aqui o idx que colocamos na adição do retângulo

                area_chapa_usada += (w/1000)*(h/1000)
                info = pecas_info[idx].copy()
                area_peca = (w/1000)*(h/1000)
                preco_m2 = PRECO_VIDRO.get(info.get("tipo_vidro","comum"), 120)
                custo_peca = area_peca * preco_m2

                for insumo, qtd in info.get("insumos", {}).items():
                    custo_peca += INSUMOS.get(insumo,0) * qtd

                custo_total += custo_peca

                resultado.append({
                    "x": x,
                    "y": y,
                    "largura": w,
                    "altura": h,
                    "tipo_vidro": info.get("tipo_vidro"),
                    "insumos": info.get("insumos"),
                    "custo": round(custo_peca,2)
                })

        perda_percent = max(0, round((area_chapa_usada - area_total_pecas) / area_total_pecas * 100,2))

        return jsonify({
            "success": True,
            "pecas": resultado,
            "custo_total": round(custo_total,2),
            "perda_percent": perda_percent
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500



