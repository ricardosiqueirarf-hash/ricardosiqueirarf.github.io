from app.repositories import pedidos_repo


def listar(empresa_id: str, busca: str = ""):
    termo = busca.strip().lower()
    lista = []
    for item in pedidos_repo.listar(empresa_id):
        cliente_nome = str(item.get("cliente_nome") or "")
        numero = str(item.get("numero_pedido") or "")
        nome = str(item.get("nome_orcamento") or "")
        if termo and termo not in f"{cliente_nome} {numero} {nome}".lower():
            continue
        lista.append({
            "id": item.get("id"),
            "cliente_id": item.get("cliente_id"),
            "cliente_nome": cliente_nome,
            "numero_pedido": numero,
            "nome_orcamento": nome or f"Orcamento {numero}",
            "status": item.get("status") or "rascunho",
            "valor_total": float(item.get("valor_total") or 0),
            "created_at": item.get("created_at"),
        })
    return lista
