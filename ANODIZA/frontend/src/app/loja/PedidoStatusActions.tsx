"use client";

type Orcamento = {
  id: string;
  status: string;
  status_label?: string;
};

type Props = {
  orcamento: Orcamento;
  perfil?: string;
  onApprove: () => void;
  onAdvance: (status: string) => void;
};

const statusLabels: Record<string, string> = {
  rascunho: "Orçamento",
  orcamento: "Orçamento",
  aprovado: "Aprovado",
  em_producao: "Em produção",
  separado: "Separado",
  entregue: "Entregue",
};

const proximosStatus: Record<string, string> = {
  aprovado: "em_producao",
  em_producao: "separado",
  separado: "entregue",
};

const botoes: Record<string, string> = {
  em_producao: "Iniciar produção",
  separado: "Marcar separado",
  entregue: "Marcar entregue",
};

export function statusNormalizado(status?: string) {
  const texto = String(status || "").trim().toLowerCase();
  if (!texto || texto === "rascunho" || texto === "orçamento") return "orcamento";
  return texto;
}

export function statusTexto(orcamento: Orcamento) {
  const status = statusNormalizado(orcamento.status);
  return orcamento.status_label || statusLabels[status] || orcamento.status || "Orçamento";
}

export default function PedidoStatusActions({ orcamento, perfil, onApprove, onAdvance }: Props) {
  const status = statusNormalizado(orcamento.status);
  const perfilNormalizado = String(perfil || "").toLowerCase();
  const proximo = proximosStatus[status];
  const podeAprovar = (perfilNormalizado === "owner" || perfilNormalizado === "gerente") && status === "orcamento";
  const podeAvancar = perfilNormalizado === "producao" && Boolean(proximo);

  return (
    <>
      {podeAprovar && <button type="button" onClick={onApprove}>Aprovar</button>}
      {podeAvancar && <button type="button" onClick={() => onAdvance(proximo)}>{botoes[proximo]}</button>}
    </>
  );
}
