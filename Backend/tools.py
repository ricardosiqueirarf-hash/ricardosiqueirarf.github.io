"""Ferramentas de alto nível do bot para consulta e orçamento."""
from __future__ import annotations

from datetime import datetime, timezone
import json
from typing import Any

from budget_calculator import calcular_orcamento
from conversation_state import (
    get_initial_state,
    get_missing_fields,
    is_ready_to_calculate,
    next_question_for_missing_fields,
    reset_state,
    update_state_from_extracted_data,
)
from database_agent import responder_pergunta_banco
from supabase_service import (
    buscar_pedido_por_numero,
    buscar_pedidos_por_cliente,
    limpar_estado_conversa,
    salvar_orcamento,
)



SENSITIVE_FIELD_MARKERS = ("senha", "password", "token", "secret", "service_role", "authorization", "apikey", "api_key")


def _redact_sensitive(value: Any, key: str = "") -> Any:
    if any(marker in key.lower() for marker in SENSITIVE_FIELD_MARKERS):
        return "[oculto]"
    if isinstance(value, dict):
        return {k: _redact_sensitive(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [_redact_sensitive(item) for item in value]
    return value


def _safe_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [_redact_sensitive(row) for row in rows]


def _infer_table_from_text(text: str) -> str | None:
    lower = (text or "").lower()
    table_keywords = {
        "orcamentos": ("orcamento", "orçamento", "pedido", "pedidos"),
        "pagamentos": ("pagamento", "pagamentos", "pago", "saldo", "financeiro"),
        "portas": ("porta", "portas"),
        "usuarios": ("usuario", "usuário", "usuarios", "usuários", "cliente", "clientes"),
        "materiais": ("material", "materiais", "insumo", "insumos", "estoque"),
        "perfis": ("perfil", "perfis", "aluminio", "alumínio"),
        "vidros": ("vidro", "vidros", "espelho", "reflecta"),
        "puxadores": ("puxador", "puxadores"),
        "trilhos": ("trilho", "trilhos"),
        "sistemas": ("sistema", "sistemas"),
        "fornecedores": ("fornecedor", "fornecedores"),
        "tarefas": ("tarefa", "tarefas"),
        "tags": ("tag", "tags"),
        "comprovantes": ("comprovante", "comprovantes"),
        "estruturas": ("estrutura", "estruturas"),
    }
    for table, keywords in table_keywords.items():
        if any(keyword in lower for keyword in keywords):
            return table
    return None


def _format_rows_preview(table: str, rows: list[dict[str, Any]]) -> str:
    if not rows:
        return f"Não encontrei registros na tabela {table}."
    preview = json.dumps(rows[:5], ensure_ascii=False, default=str, indent=2)
    if len(preview) > 2500:
        preview = preview[:2500] + "..."
    return f"Dados visualizados em {table} (somente leitura):\n{preview}"

def _currency(value: Any) -> str:
    try:
        number = float(value or 0)
        return f"R$ {number:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except (TypeError, ValueError):
        return "R$ 0,00"


def _status_label(value: Any) -> str:
    labels = {
        0: "Cancelado",
        1: "Orçamento",
        2: "Aprovado",
        3: "Em Produção",
        4: "Separado",
        5: "Entregue",
    }
    try:
        numeric = int(value)
        return labels.get(numeric, str(value))
    except (TypeError, ValueError):
        return str(value or "-")


def formatar_pedido(pedido: dict[str, Any]) -> str:
    numero = pedido.get("numero_pedido") or pedido.get("pedido") or pedido.get("numero") or pedido.get("id") or "-"
    cliente = pedido.get("cliente_nome") or pedido.get("cliente") or pedido.get("nome_cliente") or "-"
    loja = pedido.get("loja") or pedido.get("loja_nome") or pedido.get("lojaid") or pedido.get("storeid") or "-"
    total = pedido.get("total") or pedido.get("valor_total") or pedido.get("valor") or 0
    pago = pedido.get("pago") or pedido.get("valor_pago") or 0
    saldo = pedido.get("saldo")
    if saldo is None:
        try:
            saldo = float(total or 0) - float(pago or 0)
        except (TypeError, ValueError):
            saldo = 0

    return (
        "📦 Pedido encontrado\n"
        f"Pedido: {numero}\n"
        f"Cliente: {cliente}\n"
        f"Loja: {loja}\n"
        f"Total: {_currency(total)}\n"
        f"Pago: {_currency(pago)}\n"
        f"Saldo: {_currency(saldo)}\n"
        f"Status: {_status_label(pedido.get('status'))}"
    )


def handle_consultar_pedido(extracted: dict[str, Any]) -> str:
    numero = extracted.get("numero_pedido") or extracted.get("pedido") or extracted.get("numero")
    cliente = extracted.get("cliente")

    try:
        if numero:
            pedido = buscar_pedido_por_numero(numero)
            if not pedido:
                return f"Não encontrei o pedido {numero}. Confira o número e tente novamente."
            return formatar_pedido(pedido)

        if cliente:
            pedidos = buscar_pedidos_por_cliente(cliente)
            if not pedidos:
                return f"Não encontrei pedidos para o cliente {cliente}."
            if len(pedidos) == 1:
                return formatar_pedido(pedidos[0])
            linhas = ["Encontrei mais de um pedido. Qual deles você quer consultar?"]
            for pedido in pedidos[:10]:
                numero_pedido = pedido.get("numero_pedido") or pedido.get("pedido") or pedido.get("numero") or pedido.get("id") or "-"
                linhas.append(f"- Pedido {numero_pedido} | {pedido.get('cliente', '-')} | {pedido.get('status', '-')}")
            return "\n".join(linhas)

        return "Qual número do pedido ou nome do cliente?"
    except RuntimeError as exc:
        return str(exc)



def handle_pergunta_banco(user_message: str, extracted: dict[str, Any] | None = None) -> str:
    """Responde perguntas livres usando o agente SQL somente leitura."""
    return responder_pergunta_banco(user_message)

def formatar_resumo_orcamento(state: dict[str, Any]) -> str:
    dados = state.get("budget_data", {})
    calc = state.get("calculation") or {}
    return (
        "🧾 Resumo do orçamento\n"
        f"Cliente: {dados.get('cliente')}\n"
        f"Loja: {dados.get('loja')}\n"
        f"Produto: {dados.get('tipo_produto')}\n"
        f"Quantidade: {dados.get('quantidade')}\n"
        f"Medidas: {dados.get('largura_mm')} x {dados.get('altura_mm')} mm\n"
        f"Perfil/Cor: {dados.get('perfil')} {dados.get('cor')}\n"
        f"Vidro: {dados.get('vidro')}\n"
        f"Área de vidro: {calc.get('area_vidro_m2', 0):.3f} m²\n"
        f"Perímetro alumínio: {calc.get('perimetro_aluminio_ml', 0):.3f} ml\n"
        f"Total: {_currency(calc.get('total'))}\n\n"
        "Deseja salvar este orçamento? Responda sim, salvar ou confirmar."
    )


def handle_criar_orcamento(state: dict[str, Any] | None, extracted: dict[str, Any] | None) -> tuple[dict[str, Any], str]:
    current_state = state or get_initial_state()
    current_state["mode"] = "orcamento"
    current_state = update_state_from_extracted_data(current_state, extracted or {})

    missing = get_missing_fields(current_state)
    if not is_ready_to_calculate(current_state):
        question = next_question_for_missing_fields(missing)
        current_state["last_question"] = question
        current_state["pending_confirmation"] = False
        return current_state, question

    try:
        calculation = calcular_orcamento(current_state["budget_data"])
    except ValueError as exc:
        current_state["pending_confirmation"] = False
        return current_state, f"Não consegui calcular ainda: {exc}"

    current_state["calculation"] = calculation
    current_state["pending_confirmation"] = True
    current_state["last_question"] = "confirmar_salvar"
    return current_state, formatar_resumo_orcamento(current_state)


def handle_confirmar_salvar(chat_id: str | int, state: dict[str, Any] | None) -> str:
    current_state = state or reset_state()
    if not current_state.get("pending_confirmation"):
        return "Não há orçamento aguardando confirmação. Se quiser, diga 'criar orçamento'."

    dados = dict(current_state.get("budget_data", {}))
    dados["calculo"] = current_state.get("calculation", {})
    dados["total"] = (current_state.get("calculation") or {}).get("total")
    dados["origem"] = "telegram_bot"
    dados["created_at"] = datetime.now(timezone.utc).isoformat()

    try:
        salvar_orcamento(dados)
    except RuntimeError as exc:
        return str(exc)

    # Este trecho só será alcançado quando o modo somente leitura for desativado
    # explicitamente em supabase_service.py. Por enquanto, nenhuma escrita ocorre.
    limpar_estado_conversa(chat_id)
    return "✅ Orçamento salvo com sucesso."

