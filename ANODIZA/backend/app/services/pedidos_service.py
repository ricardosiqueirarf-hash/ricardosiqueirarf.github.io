import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, Request

from app.core.auth import audit_event
from app.repositories import clientes_repo, pedidos_repo
from app.repositories.common import garantir_loja_operacional
from app.schemas.pedidos import PedidoAprovar, PedidoCreate, PedidoProdutoCreate, PedidoStatusUpdate, PedidoUpdate

logger = logging.getLogger(__name__)

STATUS_ORCAMENTO = "orcamento"
STATUS_APROVADO = "aprovado"
STATUS_EM_PRODUCAO = "em_producao"
STATUS_SEPARADO = "separado"
STATUS_ENTREGUE = "entregue"

STATUS_ORDEM = {
    STATUS_ORCAMENTO: 1,
    STATUS_APROVADO: 2,
    STATUS_EM_PRODUCAO: 3,
    STATUS_SEPARADO: 4,
    STATUS_ENTREGUE: 5,
}

STATUS_LABELS = {
    STATUS_ORCAMENTO: "Orçamento",
    STATUS_APROVADO: "Aprovado",
    STATUS_EM_PRODUCAO: "Em produção",
    STATUS_SEPARADO: "Separado",
    STATUS_ENTREGUE: "Entregue",
}

STATUS_ALIASES = {
    "": STATUS_ORCAMENTO,
    "rascunho": STATUS_ORCAMENTO,
    "orcamento": STATUS_ORCAMENTO,
    "orçamento": STATUS_ORCAMENTO,
    "aprovado": STATUS_APROVADO,
    "em_producao": STATUS_EM_PRODUCAO,
    "em produção": STATUS_EM_PRODUCAO,
    "em_produção": STATUS_EM_PRODUCAO,
    "separado": STATUS_SEPARADO,
    "entregue": STATUS_ENTREGUE,
}

TRANSICOES_PRODUCAO = {
    STATUS_APROVADO: STATUS_EM_PRODUCAO,
    STATUS_EM_PRODUCAO: STATUS_SEPARADO,
    STATUS_SEPARADO: STATUS_ENTREGUE,
}

PERFIS_APROVADORES = {"owner", "gerente"}


def normalizar_status(status: str | None) -> str:
    texto = str(status or "").strip().lower()
    return STATUS_ALIASES.get(texto, texto)


def perfil_usuario(current_user: dict) -> str:
    return str(current_user.get("perfil") or "").strip().lower()


def usuario_pode_aprovar(current_user: dict) -> bool:
    return perfil_usuario(current_user) in PERFIS_APROVADORES


def usuario_pode_mover_producao(current_user: dict) -> bool:
    return perfil_usuario(current_user) == "producao"


def registrar_status_historico(dados: dict, status_anterior: str, status_novo: str, current_user: dict) -> None:
    historico = dados.get("status_historico")
    if not isinstance(historico, list):
        historico = []
    historico.append({
        "de": status_anterior,
        "para": status_novo,
        "usuario_id": current_user.get("id"),
        "usuario_nome": current_user.get("nome") or current_user.get("email") or "",
        "perfil": current_user.get("perfil") or "",
        "alterado_em": datetime.now(timezone.utc).isoformat(),
    })
    dados["status_historico"] = historico


def valor_decimal(valor) -> Decimal:
    return Decimal(str(valor or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def dividir_valor(total: float, parcelas: int) -> list[Decimal]:
    parcelas = max(1, int(parcelas or 1))
    valor_total = valor_decimal(total)
    base = (valor_total / Decimal(parcelas)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    valores = [base for _ in range(parcelas)]
    diferenca = valor_total - sum(valores, Decimal("0.00"))
    valores[-1] = (valores[-1] + diferenca).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return valores


def vencimentos_padrao(parcelas: int):
    hoje = datetime.now(timezone.utc).date()
    return [hoje + timedelta(days=7 * indice) for indice in range(parcelas)]


def montar_plano_boletos(valor_total: float, parcelas: int, vencimentos) -> dict:
    parcelas = max(1, int(parcelas or 1))
    vencimentos = list(vencimentos or [])
    if not vencimentos:
        vencimentos = vencimentos_padrao(parcelas)
    if len(vencimentos) != parcelas:
        raise HTTPException(status_code=400, detail="Informe uma data de vencimento para cada boleto")

    valores = dividir_valor(valor_total, parcelas)
    boletos = []
    for indice, vencimento in enumerate(vencimentos, start=1):
        boletos.append({
            "parcela": indice,
            "valor": float(valores[indice - 1]),
            "vencimento": vencimento.isoformat() if hasattr(vencimento, "isoformat") else str(vencimento),
            "status": "planejado",
        })

    return {
        "tipo": "boleto",
        "parcelas": parcelas,
        "valor_total": float(valor_decimal(valor_total)),
        "boletos": boletos,
        "gerar_asaas": False,
    }


def listar(empresa_id: str, busca: str = "", limit: int = 500, offset: int = 0):
    termo = busca.strip().lower()
    pedidos = pedidos_repo.listar(empresa_id, limit=limit, offset=offset)
    usuarios = {str(item.get("id")): item for item in pedidos_repo.listar_usuarios_resumo(empresa_id)}
    linhas_por_orcamento = agrupar_linhas(pedidos_repo.listar_linhas_por_orcamentos(empresa_id, [str(item.get("id")) for item in pedidos]))
    lista = []

    for item in pedidos:
        cliente_nome = str(item.get("cliente_nome") or "")
        numero = str(item.get("numero_pedido") or "")
        nome = str(item.get("nome_orcamento") or "")
        usuario = usuarios.get(str(item.get("usuario_id") or "")) or {}
        dados = item.get("dados") or {}
        resumo = resumo_financeiro(item, linhas_por_orcamento.get(str(item.get("id")), []))
        status = normalizar_status(item.get("status"))

        if termo and termo not in f"{cliente_nome} {numero} {nome} {usuario.get('nome') or ''}".lower():
            continue

        lista.append({
            "id": item.get("id"),
            "cliente_id": item.get("cliente_id"),
            "cliente_nome": cliente_nome,
            "numero_pedido": numero,
            "nome_orcamento": nome or f"Orcamento {numero}",
            "status": status,
            "status_label": STATUS_LABELS.get(status, status),
            "status_ordem": STATUS_ORDEM.get(status, 0),
            "valor_total": float(item.get("valor_total") or 0),
            "preco": resumo["preco"],
            "custo": resumo["custo"],
            "margem": resumo["margem"],
            "margem_percentual": resumo["margem_percentual"],
            "created_at": item.get("created_at"),
            "updated_at": item.get("updated_at"),
            "aprovado_em": dados.get("aprovado_em") or "",
            "usuario_id": item.get("usuario_id"),
            "usuario_nome": usuario.get("nome") or usuario.get("email") or "-",
            "aprovado_por": dados.get("aprovado_por_nome") or dados.get("aprovado_por") or "",
            "plano_boletos": dados.get("plano_boletos") or None,
        })
    return lista


def agrupar_linhas(linhas: list[dict]):
    agrupadas: dict[str, list[dict]] = {}
    for linha in linhas:
        agrupadas.setdefault(str(linha.get("orcamento_id")), []).append(linha)
    return agrupadas


def resumo_financeiro(orcamento: dict, linhas: list[dict]):
    dados = orcamento.get("dados") or {}
    preco = float(orcamento.get("valor_total") or 0)
    custo = float(dados.get("custo_total") or dados.get("custo") or 0)

    if not custo:
        custo = sum(custo_linha(linha) for linha in linhas)

    margem = preco - custo if custo else 0
    margem_percentual = (margem / preco * 100) if preco and custo else 0
    return {
        "preco": round(preco, 2),
        "custo": round(custo, 2),
        "margem": round(margem, 2),
        "margem_percentual": round(margem_percentual, 2),
    }


def custo_linha(linha: dict):
    dados = linha.get("dados") or {}
    if isinstance(dados, dict):
        if dados.get("custo_total") is not None:
            return float(dados.get("custo_total") or 0)
        calculo_snapshot = dados.get("calculo_snapshot") or {}
        if isinstance(calculo_snapshot, dict) and calculo_snapshot.get("custo_total") is not None:
            return float(calculo_snapshot.get("custo_total") or 0)
        calculo = dados.get("calculo") or {}
        if isinstance(calculo, dict) and calculo.get("custo_total") is not None:
            return float(calculo.get("custo_total") or 0)
    return 0.0


def proximo_numero(empresa_id: str, cliente_id: str | None = None) -> int:
    maior = 0
    for item in pedidos_repo.listar_numeros_por_empresa(empresa_id):
        numero = str(item.get("numero_pedido") or "").strip()
        if numero.isdigit():
            maior = max(maior, int(numero))
    return maior + 1


def loja_id_do_cliente_ou_operacao(empresa_id: str, cliente: dict):
    loja_id = str(cliente.get("loja_id") or "").strip()
    if loja_id:
        return loja_id
    loja = garantir_loja_operacional(empresa_id)
    if not loja:
        raise HTTPException(status_code=400, detail="Nao foi possivel preparar a operacao interna para criar orcamentos")
    return str(loja["id"])


def criar(empresa_id: str, payload: PedidoCreate, current_user: dict, request: Request):
    nome = payload.nome_orcamento.strip()
    cliente_id = payload.cliente_id.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do orcamento")
    if not cliente_id:
        raise HTTPException(status_code=400, detail="Selecione o cliente")
    cliente = clientes_repo.buscar_cliente(empresa_id, cliente_id)
    if not cliente:
        raise HTTPException(status_code=400, detail="Cliente nao encontrado")
    loja_id = loja_id_do_cliente_ou_operacao(empresa_id, cliente)
    dados = {
        "loja_id": loja_id,
        "usuario_id": current_user.get("id"),
        "cliente_id": cliente_id,
        "numero_pedido": str(proximo_numero(empresa_id)),
        "nome_orcamento": nome,
        "cliente_nome": cliente["nome"],
        "cliente_documento": str(cliente.get("documento") or ""),
        "cliente_telefone": str(cliente.get("telefone") or ""),
        "status": STATUS_ORCAMENTO,
        "valor_total": 0,
        "dados": {},
    }
    try:
        pedido = pedidos_repo.inserir(empresa_id, dados)
    except Exception as error:
        logger.exception("Falha ao criar orcamento: empresa_id=%s loja_id=%s cliente_id=%s numero=%s", empresa_id, loja_id, cliente_id, dados.get("numero_pedido"))
        raise HTTPException(status_code=400, detail=f"Orcamento nao criado: {str(error)}") from error
    if not pedido:
        raise HTTPException(status_code=400, detail="Orcamento nao criado")
    audit_event(current_user, "criar", "orcamento", pedido.get("id"), None, pedido, request)
    return pedido


def editar(empresa_id: str, payload: PedidoUpdate, current_user: dict, request: Request):
    pedido = pedidos_repo.buscar(empresa_id, payload.id)
    if not pedido:
        raise HTTPException(status_code=400, detail="Orcamento nao encontrado")
    cliente = clientes_repo.buscar_cliente(empresa_id, payload.cliente_id)
    if not cliente:
        raise HTTPException(status_code=400, detail="Cliente nao encontrado")
    numero = str(pedido.get("numero_pedido") or "")
    loja_id = loja_id_do_cliente_ou_operacao(empresa_id, cliente)
    dados = {"loja_id": loja_id, "cliente_id": payload.cliente_id, "cliente_nome": cliente["nome"], "cliente_documento": str(cliente.get("documento") or ""), "cliente_telefone": str(cliente.get("telefone") or ""), "numero_pedido": numero, "nome_orcamento": payload.nome_orcamento.strip()}
    atualizado = pedidos_repo.atualizar(empresa_id, payload.id, dados)
    if not atualizado:
        raise HTTPException(status_code=400, detail="Orcamento nao atualizado")
    audit_event(current_user, "editar", "orcamento", payload.id, pedido, atualizado, request)
    return atualizado


def aprovar(empresa_id: str, payload: PedidoAprovar, current_user: dict, request: Request):
    if not usuario_pode_aprovar(current_user):
        raise HTTPException(status_code=403, detail="Apenas Owner ou Gerente podem aprovar pedidos")

    pedido = pedidos_repo.buscar(empresa_id, payload.id)
    if not pedido:
        raise HTTPException(status_code=400, detail="Orcamento nao encontrado")

    status_atual = normalizar_status(pedido.get("status"))
    if status_atual != STATUS_ORCAMENTO:
        raise HTTPException(status_code=400, detail="Apenas orcamentos em status Orçamento podem ser aprovados")

    dados = dict(pedido.get("dados") or {})
    status_novo = STATUS_APROVADO
    dados["aprovado_em"] = datetime.now(timezone.utc).isoformat()
    dados["aprovado_por"] = current_user.get("id")
    dados["aprovado_por_nome"] = current_user.get("nome") or current_user.get("email") or ""
    dados["plano_boletos"] = montar_plano_boletos(float(pedido.get("valor_total") or 0), payload.parcelas_boletos, payload.vencimentos_boletos)
    registrar_status_historico(dados, status_atual, status_novo, current_user)

    atualizado = pedidos_repo.atualizar(empresa_id, payload.id, {"status": status_novo, "dados": dados})
    if not atualizado:
        raise HTTPException(status_code=400, detail="Orcamento nao aprovado")
    audit_event(current_user, "aprovar", "orcamento", payload.id, pedido, atualizado, request)
    return atualizado


def atualizar_status(empresa_id: str, payload: PedidoStatusUpdate, current_user: dict, request: Request):
    if not usuario_pode_mover_producao(current_user):
        raise HTTPException(status_code=403, detail="Apenas usuario de produção pode avançar status de produção")

    pedido = pedidos_repo.buscar(empresa_id, payload.id)
    if not pedido:
        raise HTTPException(status_code=400, detail="Orcamento nao encontrado")

    status_atual = normalizar_status(pedido.get("status"))
    status_novo = normalizar_status(payload.status)
    esperado = TRANSICOES_PRODUCAO.get(status_atual)

    if not esperado or status_novo != esperado:
        atual_label = STATUS_LABELS.get(status_atual, status_atual)
        esperado_label = STATUS_LABELS.get(esperado, "-")
        raise HTTPException(status_code=400, detail=f"Transicao invalida. Status atual: {atual_label}. Proximo permitido: {esperado_label}")

    dados = dict(pedido.get("dados") or {})
    registrar_status_historico(dados, status_atual, status_novo, current_user)
    atualizado = pedidos_repo.atualizar(empresa_id, payload.id, {"status": status_novo, "dados": dados})
    if not atualizado:
        raise HTTPException(status_code=400, detail="Status nao atualizado")
    audit_event(current_user, "alterar_status", "orcamento", payload.id, pedido, atualizado, request)
    return atualizado


def listar_linhas(empresa_id: str, item_id: str, limit: int = 500, offset: int = 0):
    if not pedidos_repo.buscar(empresa_id, item_id):
        return []
    return pedidos_repo.listar_linhas(empresa_id, item_id, limit=limit, offset=offset)


def recalcular_total(empresa_id: str, item_id: str):
    pedido = pedidos_repo.buscar(empresa_id, item_id)
    if not pedido:
        raise HTTPException(status_code=400, detail="Orcamento nao encontrado")
    linhas = pedidos_repo.listar_linhas(empresa_id, item_id, limit=5000, offset=0)
    total = sum(float(item.get("valor_total") or 0) for item in linhas)
    dados = dict(pedido.get("dados") or {})
    resumo = resumo_financeiro({**pedido, "valor_total": total, "dados": dados}, linhas)
    dados["custo_total"] = resumo["custo"]
    dados["margem_total"] = resumo["margem"]
    dados["margem_percentual"] = resumo["margem_percentual"]
    pedidos_repo.atualizar_total(empresa_id, item_id, total, dados=dados)
    return total


def criar_linha(empresa_id: str, payload: PedidoProdutoCreate, current_user: dict, request: Request):
    if not payload.nome.strip():
        raise HTTPException(status_code=400, detail="Informe o nome do produto")
    if payload.quantidade <= 0:
        raise HTTPException(status_code=400, detail="Quantidade deve ser maior que zero")
    if not pedidos_repo.buscar(empresa_id, payload.orcamento_id):
        raise HTTPException(status_code=400, detail="Orcamento nao encontrado")
    dados = {"orcamento_id": payload.orcamento_id, "nome": payload.nome.strip(), "quantidade": payload.quantidade, "valor_unitario": payload.valor_unitario, "valor_total": payload.quantidade * payload.valor_unitario, "dados": {}}
    linha = pedidos_repo.inserir_linha(empresa_id, dados)
    if not linha:
        raise HTTPException(status_code=400, detail="Produto nao cadastrado")
    recalcular_total(empresa_id, payload.orcamento_id)
    audit_event(current_user, "criar", "orcamento_produto", linha.get("id"), None, linha, request)
    return linha
