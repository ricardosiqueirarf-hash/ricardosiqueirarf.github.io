"use client";

import { useEffect, useState } from "react";

type OrcamentoAprovacao = {
  id: string;
  nome_orcamento: string;
  cliente_nome: string;
  valor_total: number;
  preco?: number;
};

type Props = {
  orcamento: OrcamentoAprovacao;
  onCancel: () => void;
  onConfirm: (payload: { parcelas_boletos: number; vencimentos_boletos: string[] }) => Promise<void>;
};

function dinheiro(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function adicionarDias(dataIso: string, dias: number) {
  const data = new Date(`${dataIso}T00:00:00`);
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

function montarVencimentos(qtd: number, primeiro = hojeIso()) {
  return Array.from({ length: qtd }, (_, index) => adicionarDias(primeiro, index * 7));
}

export default function PedidoAprovacaoPanel({ orcamento, onCancel, onConfirm }: Props) {
  const [parcelas, setParcelas] = useState(2);
  const [vencimentos, setVencimentos] = useState<string[]>(montarVencimentos(2));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setParcelas(2);
    setVencimentos(montarVencimentos(2));
    setErro("");
  }, [orcamento.id]);

  function alterarParcelas(valor: string) {
    const qtd = Math.max(1, Math.min(24, Number(valor) || 1));
    setParcelas(qtd);
    setVencimentos((datas) => Array.from({ length: qtd }, (_, index) => datas[index] || adicionarDias(datas[0] || hojeIso(), index * 7)));
  }

  function alterarVencimento(index: number, valor: string) {
    setVencimentos((datas) => datas.map((data, pos) => (pos === index ? valor : data)));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (vencimentos.length !== parcelas || vencimentos.some((data) => !data)) {
      setErro("Informe uma data para cada boleto.");
      return;
    }
    setErro("");
    setEnviando(true);
    try {
      await onConfirm({ parcelas_boletos: parcelas, vencimentos_boletos: vencimentos });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao aprovar pedido");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="metric" style={{ marginTop: 18, borderColor: "rgba(212, 175, 55, .35)" }}>
      <strong>Aprovar pedido e planejar boletos</strong>
      <p>{orcamento.nome_orcamento} • {orcamento.cliente_nome} • {dinheiro(orcamento.preco ?? orcamento.valor_total)}</p>
      <form onSubmit={submit}>
        <label>Quantidade de boletos<input type="number" min="1" max="24" value={parcelas} onChange={(e) => alterarParcelas(e.target.value)} /></label>
        {Array.from({ length: parcelas }, (_, index) => (
          <label key={index}>Vencimento boleto {index + 1}<input type="date" value={vencimentos[index] || ""} onChange={(e) => alterarVencimento(index, e.target.value)} /></label>
        ))}
        <button type="submit" disabled={enviando}>{enviando ? "Aprovando..." : "Confirmar aprovação"}</button>
        <button type="button" onClick={onCancel} disabled={enviando}>Cancelar</button>
      </form>
      {erro && <p>{erro}</p>}
      <p style={{ marginTop: 10 }}>Nesta etapa o sistema salva o plano dos boletos no pedido. A geração real no Asaas entra na próxima fase.</p>
    </div>
  );
}
