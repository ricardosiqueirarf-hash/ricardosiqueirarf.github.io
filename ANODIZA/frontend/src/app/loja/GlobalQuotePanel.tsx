"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type OrcamentoResumo = { id: string; nome_orcamento: string; cliente_nome: string; numero_pedido: string };
type ProdutoGlobal = { produto_chave: string; nome: string; classe: string; descricao: string; ativo: boolean };
type Material = {
  id: string;
  categoria: "perfil" | "vidro" | "puxador" | "insumo" | "trilho" | "componente" | "sistema" | "outro";
  nome: string;
  unidade: string;
  preco_unitario: number;
  custo_unitario?: number;
  ativo: boolean;
  configuracao?: { tipologias?: string[]; agregados?: Record<string, string[]>; puxadores_ids?: string[]; [key: string]: unknown };
};
type PortaGiroForm = {
  quantidade: string;
  largura: string;
  altura: string;
  perfil_id: string;
  vidro_id: string;
  puxador_id: string;
  medida_puxador: string;
  lado_puxador: "direito" | "esquerdo";
  altura_puxador: string;
  dobradicas: string;
  valor_adicional: string;
  observacao_venda: string;
  observacao_producao: string;
  acessorio: string;
};
type Calculo = {
  valor_unitario: number;
  valor_total: number;
  custo_total: number;
  margem: number;
  margem_percentual: number;
  dobradicas_alturas: number[];
  linhas: Array<{ nome: string; material: string; quantidade: number; unidade: string; valor_unitario: number; total: number }>;
};

const formInicial: PortaGiroForm = {
  quantidade: "1",
  largura: "800",
  altura: "2000",
  perfil_id: "",
  vidro_id: "",
  puxador_id: "sem_puxador",
  medida_puxador: "0",
  lado_puxador: "direito",
  altura_puxador: "1000",
  dobradicas: "2",
  valor_adicional: "0",
  observacao_venda: "",
  observacao_producao: "",
  acessorio: "",
};

function dinheiro(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor || 0));
}

function numero(valor: string) {
  const n = Number(String(valor || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function inteiro(valor: string, fallback = 0) {
  const n = parseInt(String(valor || ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function alturasDobradicas(alturaMm: number, quantidade: number) {
  if (!alturaMm || quantidade <= 0) return [];
  const primeira = 100;
  const ultima = Math.max(100, alturaMm - 100);
  if (quantidade === 1) return [primeira];
  const passo = (ultima - primeira) / (quantidade - 1);
  return Array.from({ length: quantidade }, (_, i) => Math.round((primeira + passo * i) * 100) / 100);
}

function idsAgregados(material: Material | undefined, categoria: string) {
  if (!material) return [];
  const config = material.configuracao || {};
  const agregados = config.agregados || {};
  return ((agregados[categoria] || (categoria === "puxador" ? config.puxadores_ids : []) || []) as string[]).map(String);
}

function DoorSvg({ form, puxador }: { form: PortaGiroForm; puxador?: Material }) {
  const largura = numero(form.largura);
  const altura = numero(form.altura);
  const dobradicas = alturasDobradicas(altura, inteiro(form.dobradicas, 0));

  if (largura <= 0 || altura <= 0) {
    return <svg className="global-door-svg" viewBox="0 0 400 600"><text x="50%" y="50%" textAnchor="middle" fill="#9ca3af">Informe largura e altura</text></svg>;
  }

  const scale = Math.min(320 / largura, 520 / altura);
  const doorWidth = largura * scale;
  const doorHeight = altura * scale;
  const x = (400 - doorWidth) / 2;
  const y = (600 - doorHeight) / 2;
  const deveDesenharPuxador = Boolean(puxador);
  const handleLength = Math.max(numero(form.medida_puxador) * scale, doorHeight * 0.4);
  const handlePos = numero(form.altura_puxador) * scale;
  const handleX = form.lado_puxador === "esquerdo" ? x + 10 : x + doorWidth - 18;
  const handleY = y + doorHeight - handlePos - handleLength / 2;
  const hingeX = form.lado_puxador === "esquerdo" ? x + doorWidth - 6 : x + 6;
  const hingeLineEnd = form.lado_puxador === "esquerdo" ? hingeX - 18 : hingeX + 18;

  return (
    <svg className="global-door-svg" viewBox="0 0 400 600" aria-label="Desenho técnico da porta de giro">
      <rect x={x} y={y} width={doorWidth} height={doorHeight} fill="#e7f3fb" stroke="#1079ba" strokeWidth="4" rx="8" />
      <rect x={x + 12} y={y + 12} width={Math.max(0, doorWidth - 24)} height={Math.max(0, doorHeight - 24)} fill="rgba(255,255,255,.42)" stroke="rgba(16,121,186,.18)" strokeWidth="2" rx="5" />
      {deveDesenharPuxador && <rect x={handleX} y={handleY} width="8" height={handleLength} fill="#f0c24c" rx="3" />}
      {dobradicas.map((alturaDobradica, index) => {
        const pos = alturaDobradica * scale;
        const yPos = y + doorHeight - pos;
        return <g key={`${alturaDobradica}-${index}`}><circle cx={hingeX} cy={yPos} r="4" fill="#0d5d8c" /><line x1={hingeX} y1={yPos} x2={hingeLineEnd} y2={yPos} stroke="#0d5d8c" strokeWidth="2" /></g>;
      })}
      <text x={x + doorWidth / 2} y={Math.max(18, y - 14)} textAnchor="middle" fill="#1f2933" fontSize="16">{largura} mm</text>
      <text x={Math.min(390, x + doorWidth + 20)} y={y + doorHeight / 2} fill="#1f2933" fontSize="16" transform={`rotate(90 ${Math.min(390, x + doorWidth + 20)} ${y + doorHeight / 2})`}>{altura} mm</text>
    </svg>
  );
}

export default function GlobalQuotePanel({ empresaSlug, orcamento, onClose, onSaved }: { empresaSlug: string; orcamento: OrcamentoResumo; onClose: () => void; onSaved: () => void }) {
  const [etapa, setEtapa] = useState<"classes" | "porta_giro">("classes");
  const [produtos, setProdutos] = useState<ProdutoGlobal[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [form, setForm] = useState<PortaGiroForm>(formInicial);
  const [calculo, setCalculo] = useState<Calculo | null>(null);
  const [mensagem, setMensagem] = useState("");

  const produtoPortaGiro = produtos.find((produto) => produto.produto_chave === "porta_giro");
  const perfis = materiais.filter((m) => m.categoria === "perfil" && m.ativo && ((m.configuracao?.tipologias || []).length === 0 || (m.configuracao?.tipologias || []).includes("giro")));
  const vidros = materiais.filter((m) => m.categoria === "vidro" && m.ativo);
  const perfilSelecionado = materiais.find((m) => m.id === form.perfil_id);
  const puxadoresPermitidosIds = idsAgregados(perfilSelecionado, "puxador");
  const puxadores = materiais.filter((m) => m.categoria === "puxador" && m.ativo && (!puxadoresPermitidosIds.length || puxadoresPermitidosIds.includes(String(m.id))));
  const puxadorSelecionado = materiais.find((m) => m.id === form.puxador_id);
  const puxadorPrecisaMedida = Boolean(puxadorSelecionado && puxadorSelecionado.unidade !== "unidade");
  const alturasPreview = useMemo(() => alturasDobradicas(numero(form.altura), inteiro(form.dobradicas, 0)), [form.altura, form.dobradicas]);

  async function carregar() {
    const [globais, mats] = await Promise.all([
      apiGet<ProdutoGlobal[]>(`/api/loja/produtos-globais?empresa_slug=${encodeURIComponent(empresaSlug)}`),
      apiGet<Material[]>(`/api/loja/materiais?empresa_slug=${encodeURIComponent(empresaSlug)}`),
    ]);
    setProdutos(globais || []);
    setMateriais(mats || []);
  }

  useEffect(() => { carregar().catch((error) => setMensagem(error instanceof Error ? error.message : "Erro ao carregar produtos globais")); }, [empresaSlug]);

  function atualizar(campo: keyof PortaGiroForm, valor: string) {
    const proximo = { ...form, [campo]: valor } as PortaGiroForm;
    if (campo === "perfil_id") proximo.puxador_id = "sem_puxador";
    if (campo === "puxador_id") {
      const proxPuxador = materiais.find((m) => m.id === valor);
      if (!proxPuxador || proxPuxador.unidade === "unidade") proximo.medida_puxador = "0";
    }
    setForm(proximo);
    setCalculo(null);
  }

  function payload() {
    return {
      empresa_slug: empresaSlug,
      orcamento_id: orcamento.id,
      quantidade: inteiro(form.quantidade, 1),
      largura: numero(form.largura),
      altura: numero(form.altura),
      perfil_id: form.perfil_id,
      vidro_id: form.vidro_id,
      puxador_id: form.puxador_id || "sem_puxador",
      medida_puxador: numero(form.medida_puxador),
      lado_puxador: form.lado_puxador,
      altura_puxador: numero(form.altura_puxador),
      dobradicas: inteiro(form.dobradicas, 2),
      valor_adicional: numero(form.valor_adicional),
      observacao_venda: form.observacao_venda,
      observacao_producao: form.observacao_producao,
      acessorio: form.acessorio,
    };
  }

  async function alternarAtivo(ativo: boolean) {
    await apiPost("/api/loja/produtos-globais/alternar", { empresa_slug: empresaSlug, produto_chave: "porta_giro", ativo });
    await carregar();
  }

  async function calcular() {
    setMensagem("");
    try {
      const resultado = await apiPost<Calculo>("/api/loja/produtos-globais/porta-giro/calcular", payload());
      setCalculo(resultado);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao calcular porta");
    }
  }

  async function adicionar() {
    setMensagem("");
    try {
      await apiPost("/api/loja/produtos-globais/porta-giro/adicionar-orcamento", payload());
      await onSaved();
      onClose();
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao adicionar porta ao orçamento");
    }
  }

  return (
    <section className="card" style={{ maxWidth: "none", marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div><h1>Orçamento</h1><p>{orcamento.cliente_nome} • #{orcamento.numero_pedido} • {orcamento.nome_orcamento}</p></div>
        <button type="button" onClick={onClose}>Fechar</button>
      </div>
      {mensagem && <p>{mensagem}</p>}

      {etapa === "classes" && (
        <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
          <div><h2>Escolha a classe do orçamento</h2><p>Produtos globais padrão do ANODIZA. A empresa pode ativar ou desativar cada produto.</p></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <article className="metric" style={{ minHeight: 260 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><strong>Porta de Giro</strong><span>{produtoPortaGiro?.ativo === false ? "Desativado" : "Ativo"}</span></div>
              <p>Altura, largura, perfil, vidro, puxador, lado do puxador e dobradiças automáticas.</p>
              <div style={{ margin: "16px auto", maxWidth: 220 }}><DoorSvg form={formInicial} /></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" disabled={produtoPortaGiro?.ativo === false} onClick={() => setEtapa("porta_giro")}>Abrir orçamento</button>
                <button type="button" onClick={() => alternarAtivo(!(produtoPortaGiro?.ativo === false))}>{produtoPortaGiro?.ativo === false ? "Ativar" : "Desativar"}</button>
              </div>
            </article>
            <article className="metric" style={{ opacity: .6 }}><strong>Portas deslizantes</strong><p>Disponível em breve.</p></article>
            <article className="metric" style={{ opacity: .6 }}><strong>Estruturas 3D</strong><p>Disponível em breve.</p></article>
          </div>
        </div>
      )}

      {etapa === "porta_giro" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 480px) 1fr", gap: 18, alignItems: "start", marginTop: 18 }}>
          <form onSubmit={(e) => { e.preventDefault(); calcular(); }}>
            <h2>Porta de Giro</h2>
            <label>Quantidade<input type="number" min="1" value={form.quantidade} onChange={(e) => atualizar("quantidade", e.target.value)} /></label>
            <label>Largura (mm)<input type="number" min="1" value={form.largura} onChange={(e) => atualizar("largura", e.target.value)} /></label>
            <label>Altura (mm)<input type="number" min="201" value={form.altura} onChange={(e) => atualizar("altura", e.target.value)} /></label>
            <label>Perfil<select value={form.perfil_id} onChange={(e) => atualizar("perfil_id", e.target.value)}><option value="">Selecione</option>{perfis.map((m) => <option key={m.id} value={m.id}>{m.nome} • {dinheiro(m.preco_unitario)}/m</option>)}</select></label>
            <label>Vidro<select value={form.vidro_id} onChange={(e) => atualizar("vidro_id", e.target.value)}><option value="">Selecione</option>{vidros.map((m) => <option key={m.id} value={m.id}>{m.nome} • {dinheiro(m.preco_unitario)}/m²</option>)}</select></label>
            <label>Puxador<select value={form.puxador_id} onChange={(e) => atualizar("puxador_id", e.target.value)}><option value="sem_puxador">Sem puxador</option>{puxadores.map((m) => <option key={m.id} value={m.id}>{m.nome} • {dinheiro(m.preco_unitario)}/{m.unidade === "metro_linear" ? "m" : "un"}</option>)}</select></label>
            {puxadorPrecisaMedida && <label>Tamanho do puxador (mm)<input type="number" min="1" value={form.medida_puxador} onChange={(e) => atualizar("medida_puxador", e.target.value)} /></label>}
            <label>Lado do puxador<select value={form.lado_puxador} onChange={(e) => atualizar("lado_puxador", e.target.value as "direito" | "esquerdo")}><option value="direito">Direito</option><option value="esquerdo">Esquerdo</option></select></label>
            <label>Altura do puxador (mm)<input type="number" min="0" value={form.altura_puxador} onChange={(e) => atualizar("altura_puxador", e.target.value)} /></label>
            <label>Quantidade de dobradiças<input type="number" min="2" max="12" value={form.dobradicas} onChange={(e) => atualizar("dobradicas", e.target.value)} /></label>
            <p>Alturas: {alturasPreview.length ? alturasPreview.join(", ") : "-"} mm</p>
            <label>Valor adicional (R$)<input type="number" min="0" step="0.01" value={form.valor_adicional} onChange={(e) => atualizar("valor_adicional", e.target.value)} /></label>
            <label>Acessório<textarea rows={2} value={form.acessorio} onChange={(e) => atualizar("acessorio", e.target.value)} /></label>
            <label>Observação de venda<textarea rows={2} value={form.observacao_venda} onChange={(e) => atualizar("observacao_venda", e.target.value)} /></label>
            <label>Observação de produção<textarea rows={2} value={form.observacao_producao} onChange={(e) => atualizar("observacao_producao", e.target.value)} /></label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="submit">Calcular</button><button type="button" onClick={adicionar}>Adicionar ao orçamento</button><button type="button" onClick={() => setEtapa("classes")}>Voltar</button></div>
          </form>
          <div className="metric">
            <DoorSvg form={form} puxador={puxadorSelecionado} />
            {calculo && <div style={{ display: "grid", gap: 8, marginTop: 14 }}><strong>Total: {dinheiro(calculo.valor_total)}</strong><p>Unitário: {dinheiro(calculo.valor_unitario)} • Custo: {dinheiro(calculo.custo_total)} • Margem: {dinheiro(calculo.margem)} ({calculo.margem_percentual.toFixed(1).replace(".", ",")}%)</p>{calculo.linhas.map((linha, i) => <p key={i}>{linha.nome} — {linha.material}: {linha.quantidade} {linha.unidade} × {dinheiro(linha.valor_unitario)} = {dinheiro(linha.total)}</p>)}</div>}
          </div>
        </div>
      )}
    </section>
  );
}
