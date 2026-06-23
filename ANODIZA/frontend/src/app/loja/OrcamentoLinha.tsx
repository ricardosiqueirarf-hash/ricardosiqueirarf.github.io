"use client";

import PedidoStatusActions from "./PedidoStatusActions";
import { dataHoraCurta, moeda, porcentagem } from "./formatos";
import { statusLabel } from "./orcamentoStatus";

export type OrcamentoLinhaItem = {
  id: string;
  nome_orcamento: string;
  cliente_nome: string;
  numero_pedido: string;
  status: string;
  status_label?: string;
  valor_total: number;
  preco?: number;
  custo?: number;
  margem?: number;
  margem_percentual?: number;
  cliente_id?: string;
  created_at?: string;
  aprovado_em?: string;
  usuario_nome?: string;
  plano_boletos?: { parcelas?: number } | null;
};

type Props = {
  item: OrcamentoLinhaItem;
  perfil?: string;
  onOpen: () => void;
  onEdit: () => void;
  onApprove: () => void;
  onAdvance: (status: string) => void;
};

export default function OrcamentoLinha({ item, perfil, onOpen, onEdit, onApprove, onAdvance }: Props) {
  return (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      <td style={{ padding: 10 }}>{item.numero_pedido || "-"}</td>
      <td style={{ padding: 10 }}><strong>{item.nome_orcamento}</strong></td>
      <td style={{ padding: 10 }}>{item.cliente_nome || "-"}</td>
      <td style={{ padding: 10 }}>{dataHoraCurta(item.created_at)}</td>
      <td style={{ padding: 10 }}>{dataHoraCurta(item.aprovado_em)}</td>
      <td style={{ padding: 10, textAlign: "right" }}>{moeda(item.custo || 0)}</td>
      <td style={{ padding: 10, textAlign: "right" }}>{moeda(item.margem || 0)} <small>({porcentagem(item.margem_percentual)})</small></td>
      <td style={{ padding: 10, textAlign: "right" }}>{moeda(item.preco ?? item.valor_total)}</td>
      <td style={{ padding: 10 }}><strong>{item.status_label || statusLabel(item.status)}</strong></td>
      <td style={{ padding: 10 }}>{item.usuario_nome || "-"}</td>
      <td style={{ padding: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={onOpen}>Orçamento</button>
          <button type="button" onClick={onEdit}>Editar</button>
          <PedidoStatusActions orcamento={item} perfil={perfil} onApprove={onApprove} onAdvance={onAdvance} />
        </div>
      </td>
    </tr>
  );
}
