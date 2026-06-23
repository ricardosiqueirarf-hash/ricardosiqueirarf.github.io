export function statusNormalizado(status?: string) {
  const texto = String(status || "").trim().toLowerCase();
  if (!texto || texto === "rascunho" || texto === "orçamento") return "orcamento";
  return texto;
}

export function statusLabel(status?: string) {
  const atual = statusNormalizado(status);
  const labels: Record<string, string> = {
    rascunho: "Orçamento",
    orcamento: "Orçamento",
    aprovado: "Aprovado",
    em_producao: "Em produção",
    separado: "Separado",
    entregue: "Entregue",
  };
  return labels[atual] || status || "Orçamento";
}
