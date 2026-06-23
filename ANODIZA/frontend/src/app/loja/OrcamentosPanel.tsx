"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";
import GlobalQuotePanel from "./GlobalQuotePanel";
import OrcamentoLinha, { type OrcamentoLinhaItem } from "./OrcamentoLinha";
import PedidoAprovacaoPanel from "./PedidoAprovacaoPanel";

export type ClienteResumo = { id: string; nome: string };
export type OrcamentoResumo = OrcamentoLinhaItem;

type Props = {
  empresaSlug: string;
  perfilUsuario?: string;
  clientes: ClienteResumo[];
  orcamentos: OrcamentoResumo[];
  onReload: () => Promise<void>;
  setMensagem: (valor: string) => void;
};

const vazio = { nome_orcamento: "", cliente_id: "" };

export default function OrcamentosPanel({ empresaSlug, perfilUsuario, clientes, orcamentos, onReload, setMensagem }: Props) {
  const [form, setForm] = useState(vazio);
  const [editandoId, setEditandoId] = useState("");
  const [orcamentoProduto, setOrcamentoProduto] = useState<OrcamentoResumo | null>(null);
  const [orcamentoAprovacao, setOrcamentoAprovacao] = useState<OrcamentoResumo | null>(null);

  function resetar() {
    setForm(vazio);
    setEditandoId("");
  }

  function editar(orcamento: OrcamentoResumo) {
    setEditandoId(orcamento.id);
    setForm({ nome_orcamento: orcamento.nome_orcamento || "", cliente_id: orcamento.cliente_id || "" });
    setMensagem("");
  }

  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("");
    try {
      if (editandoId) {
        await apiPost("/api/loja/orcamentos/editar", { empresa_slug: empresaSlug, id: editandoId, ...form });
      } else {
        await apiPost("/api/loja/orcamentos", { empresa_slug: empresaSlug, ...form });
      }
      resetar();
      await onReload();
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao salvar orçamento");
    }
  }

  async function confirmarAprovacao(payload: { parcelas_boletos: number; vencimentos_boletos: string[] }) {
    if (!orcamentoAprovacao) return;
    await apiPost("/api/loja/orcamentos/aprovar", { empresa_slug: empresaSlug, id: orcamentoAprovacao.id, ...payload });
    setOrcamentoAprovacao(null);
    await onReload();
  }

  async function avancar(orcamento: OrcamentoResumo, status: string) {
    if (!window.confirm("Confirmar avanço de status?")) return;
    setMensagem("");
    try {
      await apiPost("/api/loja/orcamentos/status", { empresa_slug: empresaSlug, id: orcamento.id, status });
      await onReload();
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao alterar status");
    }
  }

  return (
    <section className="card" style={{ maxWidth: "none" }}>
      <h1>Orçamentos</h1>
      <form onSubmit={salvar}>
        <label>Nome<input value={form.nome_orcamento} onChange={(e) => setForm({ ...form, nome_orcamento: e.target.value })} /></label>
        <label>Cliente<select value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}><option value="">Selecione</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        <button>{editandoId ? "Salvar alterações" : "Criar"}</button>
        {editandoId && <button type="button" onClick={resetar}>Cancelar edição</button>}
      </form>

      {orcamentoProduto && <GlobalQuotePanel empresaSlug={empresaSlug} orcamento={orcamentoProduto} onClose={() => setOrcamentoProduto(null)} onSaved={onReload} />}
      {orcamentoAprovacao && <PedidoAprovacaoPanel orcamento={orcamentoAprovacao} onCancel={() => setOrcamentoAprovacao(null)} onConfirm={confirmarAprovacao} />}

      <div style={{ overflowX: "auto", marginTop: 18 }}>
        <table style={{ width: "100%", minWidth: 1380, borderCollapse: "collapse" }}>
          <thead><tr><th style={{ textAlign: "left", padding: 10 }}>#</th><th style={{ textAlign: "left", padding: 10 }}>Orçamento</th><th style={{ textAlign: "left", padding: 10 }}>Cliente</th><th style={{ textAlign: "left", padding: 10 }}>Criação</th><th style={{ textAlign: "left", padding: 10 }}>Aprovação</th><th style={{ textAlign: "right", padding: 10 }}>Custo</th><th style={{ textAlign: "right", padding: 10 }}>Margem</th><th style={{ textAlign: "right", padding: 10 }}>Preço</th><th style={{ textAlign: "left", padding: 10 }}>Status</th><th style={{ textAlign: "left", padding: 10 }}>Criado por</th><th style={{ textAlign: "left", padding: 10 }}>Ações</th></tr></thead>
          <tbody>{orcamentos.map((o) => <OrcamentoLinha key={o.id} item={o} perfil={perfilUsuario} onOpen={() => { setOrcamentoProduto(o); setOrcamentoAprovacao(null); }} onEdit={() => editar(o)} onApprove={() => { setOrcamentoAprovacao(o); setOrcamentoProduto(null); }} onAdvance={(status) => avancar(o, status)} />)}</tbody>
        </table>
        {!orcamentos.length && <p style={{ marginTop: 12 }}>Nenhum orçamento cadastrado.</p>}
      </div>
    </section>
  );
}
