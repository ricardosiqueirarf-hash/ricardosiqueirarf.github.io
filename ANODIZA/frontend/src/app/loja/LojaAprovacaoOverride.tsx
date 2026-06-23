"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type Orcamento = { id: string; nome_orcamento: string; cliente_nome: string; numero_pedido: string; valor_total: number; preco?: number; status: string };

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function adicionarDias(dataIso: string, dias: number) {
  const data = new Date(`${dataIso}T00:00:00`);
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

function datasPadrao(qtd: number, primeiro = hojeIso()) {
  return Array.from({ length: qtd }, (_, index) => adicionarDias(primeiro, index * 7));
}

function dinheiro(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
}

export default function LojaAprovacaoOverride() {
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [parcelas, setParcelas] = useState(2);
  const [vencimentos, setVencimentos] = useState<string[]>(datasPadrao(2));
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    function isLoja() {
      return window.location.pathname === "/loja" || window.location.pathname.startsWith("/loja/");
    }

    async function abrirPorLinha(botao: HTMLButtonElement) {
      const slug = window.localStorage.getItem("anodiza_empresa_slug") || "";
      const linha = botao.closest("tr");
      const colunas = linha ? Array.from(linha.querySelectorAll("td")) : [];
      const numero = (colunas[0]?.textContent || "").trim();
      const nome = (colunas[1]?.querySelector("strong")?.textContent || colunas[1]?.textContent || "").trim();
      const params = new URLSearchParams({ empresa_slug: slug, busca: nome });
      const lista = await apiGet<Orcamento[]>(`/api/loja/orcamentos?${params.toString()}`);
      const encontrado = lista.find((item) => String(item.numero_pedido || "") === numero) || lista.find((item) => item.nome_orcamento === nome);
      if (!encontrado) {
        setErro("Não consegui localizar esse orçamento para aprovar.");
        return;
      }
      setErro("");
      setParcelas(2);
      setVencimentos(datasPadrao(2));
      setOrcamento(encontrado);
    }

    function capturarClique(event: MouseEvent) {
      if (!isLoja()) return;
      const alvo = event.target as HTMLElement | null;
      const botao = alvo?.closest("button") as HTMLButtonElement | null;
      if (!botao) return;
      if ((botao.textContent || "").trim() !== "Aprovar") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void abrirPorLinha(botao);
    }

    document.addEventListener("click", capturarClique, true);
    return () => document.removeEventListener("click", capturarClique, true);
  }, []);

  function alterarParcelas(valor: string) {
    const qtd = Math.max(1, Math.min(24, Number(valor) || 1));
    setParcelas(qtd);
    setVencimentos((datas) => Array.from({ length: qtd }, (_, index) => datas[index] || adicionarDias(datas[0] || hojeIso(), index * 7)));
  }

  async function aprovar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orcamento) return;
    if (vencimentos.length !== parcelas || vencimentos.some((data) => !data)) {
      setErro("Informe uma data para cada boleto.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      const slug = window.localStorage.getItem("anodiza_empresa_slug") || "";
      await apiPost("/api/loja/orcamentos/aprovar", { empresa_slug: slug, id: orcamento.id, parcelas_boletos: parcelas, vencimentos_boletos: vencimentos });
      setOrcamento(null);
      window.location.reload();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao aprovar pedido");
    } finally {
      setEnviando(false);
    }
  }

  if (!orcamento && !erro) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "grid", placeItems: "center", padding: 24, background: "rgba(0,0,0,.62)", backdropFilter: "blur(10px)" }}>
      <section className="card" style={{ width: "min(560px, 100%)", maxWidth: 560 }}>
        <h1>Aprovar pedido</h1>
        {orcamento && <p>{orcamento.nome_orcamento} • {orcamento.cliente_nome} • {dinheiro(orcamento.preco ?? orcamento.valor_total)}</p>}
        <form onSubmit={aprovar}>
          <label>Quantidade de boletos<input type="number" min="1" max="24" value={parcelas} onChange={(e) => alterarParcelas(e.target.value)} /></label>
          {Array.from({ length: parcelas }, (_, index) => <label key={index}>Vencimento boleto {index + 1}<input type="date" value={vencimentos[index] || ""} onChange={(e) => setVencimentos((datas) => datas.map((data, pos) => pos === index ? e.target.value : data))} /></label>)}
          <button type="submit" disabled={!orcamento || enviando}>{enviando ? "Aprovando..." : "Confirmar aprovação"}</button>
          <button type="button" disabled={enviando} onClick={() => { setOrcamento(null); setErro(""); }}>Cancelar</button>
        </form>
        {erro && <p>{erro}</p>}
      </section>
    </div>
  );
}
