"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";

type Boleto = { parcela: number; valor: number; vencimento: string; status?: string };
type Orcamento = {
  id: string;
  numero_pedido: string;
  nome_orcamento: string;
  cliente_nome: string;
  status: string;
  preco?: number;
  valor_total: number;
  plano_boletos?: { parcelas?: number; boletos?: Boleto[] } | null;
};

type GrupoCliente = { cliente: string; total: number; boletos: Array<Boleto & { pedido: Orcamento }> };

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
}

function data(valor?: string) {
  if (!valor) return "-";
  const d = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(d.getTime())) return valor;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

function statusValido(status?: string) {
  const s = String(status || "").toLowerCase();
  return ["aprovado", "em_producao", "separado", "entregue"].includes(s);
}

export default function LojaFinanceiroOverlay() {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [pedidos, setPedidos] = useState<Orcamento[]>([]);

  async function carregar() {
    const slug = window.localStorage.getItem("anodiza_empresa_slug") || "";
    setCarregando(true);
    setErro("");
    try {
      const params = new URLSearchParams({ empresa_slug: slug, busca: "" });
      const lista = await apiGet<Orcamento[]>(`/api/loja/orcamentos?${params.toString()}`);
      setPedidos(lista.filter((pedido) => statusValido(pedido.status)));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar financeiro");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    function instalarBotao() {
      if (!(window.location.pathname === "/loja" || window.location.pathname.startsWith("/loja/"))) return;
      const nav = document.querySelector(".app-nav");
      if (!nav || nav.querySelector("[data-loja-financeiro]")) return;
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "nav-primary-button";
      botao.setAttribute("data-loja-financeiro", "true");
      botao.innerHTML = '<span class="nav-icon">R$</span><span class="nav-label">Financeiro</span><span class="nav-chevron">›</span>';
      botao.addEventListener("click", () => {
        setAberto(true);
        void carregar();
      });
      const logout = nav.querySelector(".nav-logout");
      nav.insertBefore(botao, logout || null);
    }

    instalarBotao();
    const timer = window.setInterval(instalarBotao, 800);
    return () => window.clearInterval(timer);
  }, []);

  const grupos = useMemo<GrupoCliente[]>(() => {
    const mapa = new Map<string, GrupoCliente>();
    for (const pedido of pedidos) {
      const cliente = pedido.cliente_nome || "Cliente sem nome";
      const grupo = mapa.get(cliente) || { cliente, total: 0, boletos: [] };
      const boletos = pedido.plano_boletos?.boletos || [];
      for (const boleto of boletos) {
        grupo.total += Number(boleto.valor || 0);
        grupo.boletos.push({ ...boleto, pedido });
      }
      mapa.set(cliente, grupo);
    }
    return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
  }, [pedidos]);

  const total = grupos.reduce((soma, grupo) => soma + grupo.total, 0);
  const quantidade = grupos.reduce((soma, grupo) => soma + grupo.boletos.length, 0);

  if (!aberto) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, padding: 24, background: "rgba(0,0,0,.58)", backdropFilter: "blur(10px)", overflow: "auto" }}>
      <section className="card" style={{ maxWidth: 1180, margin: "40px auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
          <div>
            <p className="dashboard-kicker">Financeiro · Asaas</p>
            <h1>Boletos a receber</h1>
            <p>Pedidos aprovados agrupados por cliente. A conciliação real com o Asaas entra na próxima etapa da integração.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={carregar}>Atualizar</button>
            <button type="button" onClick={() => setAberto(false)}>Fechar</button>
          </div>
        </div>

        <div className="grid" style={{ marginTop: 16 }}>
          <div className="metric"><p>Total a receber</p><strong>{moeda(total)}</strong></div>
          <div className="metric"><p>Boletos planejados</p><strong>{quantidade}</strong></div>
          <div className="metric"><p>Clientes</p><strong>{grupos.length}</strong></div>
        </div>

        {erro && <p>{erro}</p>}
        {carregando && <p>Carregando financeiro...</p>}
        {!carregando && !grupos.length && <p>Nenhum boleto planejado encontrado em pedidos aprovados.</p>}

        <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
          {grupos.map((grupo) => (
            <div className="metric" key={grupo.cliente}>
              <strong>{grupo.cliente}</strong>
              <p>Total: {moeda(grupo.total)} • {grupo.boletos.length} boleto(s)</p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse" }}>
                  <thead><tr><th style={{ textAlign: "left", padding: 8 }}>Pedido</th><th style={{ textAlign: "left", padding: 8 }}>Orçamento</th><th style={{ textAlign: "left", padding: 8 }}>Parcela</th><th style={{ textAlign: "left", padding: 8 }}>Vencimento</th><th style={{ textAlign: "right", padding: 8 }}>Valor</th><th style={{ textAlign: "left", padding: 8 }}>Asaas</th></tr></thead>
                  <tbody>{grupo.boletos.map((boleto) => <tr key={`${boleto.pedido.id}-${boleto.parcela}`} style={{ borderTop: "1px solid var(--border)" }}><td style={{ padding: 8 }}>{boleto.pedido.numero_pedido || "-"}</td><td style={{ padding: 8 }}>{boleto.pedido.nome_orcamento}</td><td style={{ padding: 8 }}>{boleto.parcela}</td><td style={{ padding: 8 }}>{data(boleto.vencimento)}</td><td style={{ padding: 8, textAlign: "right" }}>{moeda(boleto.valor)}</td><td style={{ padding: 8 }}>{boleto.status || "planejado"}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
