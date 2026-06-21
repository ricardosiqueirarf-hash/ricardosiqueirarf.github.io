"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type CategoriaMaterial = "perfil" | "vidro" | "puxador" | "insumo" | "trilho" | "componente" | "outro";
type TipoCampo = "numero" | "texto" | "material" | "booleano";
type OrigemComponente = "campo_material" | "insumos_do_material" | "tag_regras" | "valor_adicional";
type BaseQuantidade = "unidade" | "area" | "perimetro" | "largura_m" | "altura_m" | "campo_numero" | "campo_mm_para_m";

type CampoProduto = {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  categoria?: CategoriaMaterial;
  obrigatorio: boolean;
  padrao?: unknown;
  permitir_sem_item?: boolean;
};

type ComponenteProduto = {
  nome: string;
  origem: OrigemComponente;
  campo_material?: string;
  campo_origem?: string;
  base_quantidade: BaseQuantidade;
  multiplicador: number;
};

type ProdutoConfig = {
  campos: CampoProduto[];
  componentes: ComponenteProduto[];
  medidas: { largura: string; altura: string };
};

type Produto = {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  configuracao: ProdutoConfig;
};

type Material = {
  id: string;
  nome: string;
  categoria: CategoriaMaterial;
  unidade: string;
  preco_unitario: number;
  ativo: boolean;
};

type Orcamento = { id: string; nome_orcamento: string; cliente_nome: string; numero_pedido: string; valor_total: number };
type LinhaCalculo = { nome: string; material?: string; quantidade: number; unidade: string; valor_unitario: number; total: number };
type Calculo = { nome: string; quantidade: number; valor_unitario: number; valor_total: number; linhas: LinhaCalculo[]; medidas: Record<string, number> };

type ProdutoForm = {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  campos: CampoProduto[];
  componentes: ComponenteProduto[];
  largura_key: string;
  altura_key: string;
};

const categorias: Array<{ value: CategoriaMaterial; label: string }> = [
  { value: "perfil", label: "Perfil" },
  { value: "vidro", label: "Vidro" },
  { value: "puxador", label: "Puxador" },
  { value: "insumo", label: "Insumo" },
  { value: "trilho", label: "Trilho" },
  { value: "componente", label: "Componente" },
  { value: "outro", label: "Outro" },
];

const bases: Array<{ value: BaseQuantidade; label: string }> = [
  { value: "unidade", label: "Unidade fixa" },
  { value: "area", label: "Área (largura x altura)" },
  { value: "perimetro", label: "Perímetro 2x(L+A)" },
  { value: "largura_m", label: "Largura em metro" },
  { value: "altura_m", label: "Altura em metro" },
  { value: "campo_numero", label: "Campo numérico" },
  { value: "campo_mm_para_m", label: "Campo em mm convertido para m" },
];

const produtoInicial: ProdutoForm = {
  id: "",
  nome: "",
  descricao: "",
  ativo: true,
  campos: [],
  componentes: [],
  largura_key: "largura",
  altura_key: "altura",
};

const campoInicial: CampoProduto = { chave: "", rotulo: "", tipo: "numero", obrigatorio: true, categoria: "perfil" };
const componenteInicial: ComponenteProduto = { nome: "", origem: "campo_material", campo_material: "", campo_origem: "", base_quantidade: "unidade", multiplicador: 1 };

function dinheiro(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor || 0));
}

function slug(texto: string) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function categoriaLabel(categoria?: CategoriaMaterial) {
  return categorias.find((item) => item.value === categoria)?.label || categoria || "-";
}

function configFromForm(form: ProdutoForm): ProdutoConfig {
  return {
    campos: form.campos,
    componentes: form.componentes,
    medidas: { largura: form.largura_key || "largura", altura: form.altura_key || "altura" },
  };
}

function formFromProduto(produto: Produto): ProdutoForm {
  const config = produto.configuracao || { campos: [], componentes: [], medidas: { largura: "largura", altura: "altura" } };
  return {
    id: produto.id,
    nome: produto.nome,
    descricao: produto.descricao || "",
    ativo: produto.ativo,
    campos: config.campos || [],
    componentes: config.componentes || [],
    largura_key: config.medidas?.largura || "largura",
    altura_key: config.medidas?.altura || "altura",
  };
}

function portaGiroModelo(): ProdutoForm {
  return {
    id: "",
    nome: "Porta de Giro",
    descricao: "Modelo editável baseado no orçamento antigo da ColorGlass: perfil por perímetro, vidro por área, insumos do perfil, puxador, tags e valor adicional.",
    ativo: true,
    largura_key: "largura",
    altura_key: "altura",
    campos: [
      { chave: "largura", rotulo: "Largura (mm)", tipo: "numero", obrigatorio: true, padrao: 800 },
      { chave: "altura", rotulo: "Altura (mm)", tipo: "numero", obrigatorio: true, padrao: 2000 },
      { chave: "perfil", rotulo: "Perfil", tipo: "material", categoria: "perfil", obrigatorio: true },
      { chave: "vidro", rotulo: "Vidro", tipo: "material", categoria: "vidro", obrigatorio: true },
      { chave: "puxador", rotulo: "Puxador", tipo: "material", categoria: "puxador", obrigatorio: false, permitir_sem_item: true },
      { chave: "medida_puxador", rotulo: "Tamanho do puxador (mm)", tipo: "numero", obrigatorio: false, padrao: 0 },
      { chave: "dobradicas", rotulo: "Quantidade de dobradiças", tipo: "numero", obrigatorio: false, padrao: 2 },
      { chave: "valor_adicional", rotulo: "Valor adicional (R$)", tipo: "numero", obrigatorio: false, padrao: 0 },
    ],
    componentes: [
      { nome: "Perfil", origem: "campo_material", campo_material: "perfil", base_quantidade: "perimetro", multiplicador: 1 },
      { nome: "Vidro", origem: "campo_material", campo_material: "vidro", base_quantidade: "area", multiplicador: 1 },
      { nome: "Insumos do perfil", origem: "insumos_do_material", campo_material: "perfil", base_quantidade: "perimetro", multiplicador: 1 },
      { nome: "Puxador", origem: "campo_material", campo_material: "puxador", campo_origem: "medida_puxador", base_quantidade: "campo_mm_para_m", multiplicador: 1 },
      { nome: "Regras por tags", origem: "tag_regras", base_quantidade: "unidade", multiplicador: 1 },
      { nome: "Valor adicional", origem: "valor_adicional", campo_origem: "valor_adicional", base_quantidade: "unidade", multiplicador: 1 },
    ],
  };
}

export default function ProdutosPanel({ empresaSlug }: { empresaSlug: string }) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [form, setForm] = useState<ProdutoForm>(produtoInicial);
  const [novoCampo, setNovoCampo] = useState<CampoProduto>(campoInicial);
  const [novoComponente, setNovoComponente] = useState<ComponenteProduto>(componenteInicial);
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [orcamentoSelecionado, setOrcamentoSelecionado] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [calculo, setCalculo] = useState<Calculo | null>(null);
  const [mensagem, setMensagem] = useState("");

  const produtoAtual = useMemo(() => produtos.find((produto) => produto.id === produtoSelecionado) || null, [produtos, produtoSelecionado]);

  async function carregarTudo() {
    if (!empresaSlug) return;
    const [produtosLista, materiaisLista, orcamentosLista] = await Promise.all([
      apiGet<Produto[]>(`/api/loja/produtos?empresa_slug=${encodeURIComponent(empresaSlug)}`),
      apiGet<Material[]>(`/api/loja/materiais?empresa_slug=${encodeURIComponent(empresaSlug)}`),
      apiGet<Orcamento[]>(`/api/loja/orcamentos?empresa_slug=${encodeURIComponent(empresaSlug)}`),
    ]);
    setProdutos(produtosLista || []);
    setMateriais(materiaisLista || []);
    setOrcamentos(orcamentosLista || []);
  }

  useEffect(() => {
    carregarTudo().catch((error) => setMensagem(error instanceof Error ? error.message : "Erro ao carregar produtos"));
  }, [empresaSlug]);

  useEffect(() => {
    if (!produtoAtual) return;
    const iniciais: Record<string, string> = {};
    for (const campo of produtoAtual.configuracao?.campos || []) {
      if (campo.padrao !== undefined && campo.padrao !== null) iniciais[campo.chave] = String(campo.padrao);
      else iniciais[campo.chave] = "";
    }
    setValores(iniciais);
    setCalculo(null);
  }, [produtoAtual?.id]);

  function adicionarCampo() {
    const chave = slug(novoCampo.chave || novoCampo.rotulo);
    if (!chave || !novoCampo.rotulo) {
      setMensagem("Informe chave e nome do campo");
      return;
    }
    if (form.campos.some((campo) => campo.chave === chave)) {
      setMensagem("Ja existe um campo com esta chave");
      return;
    }
    setForm({ ...form, campos: [...form.campos, { ...novoCampo, chave }] });
    setNovoCampo(campoInicial);
  }

  function removerCampo(chave: string) {
    setForm({
      ...form,
      campos: form.campos.filter((campo) => campo.chave !== chave),
      componentes: form.componentes.filter((componente) => componente.campo_material !== chave && componente.campo_origem !== chave),
    });
  }

  function adicionarComponente() {
    if (!novoComponente.nome) {
      setMensagem("Informe o nome do componente");
      return;
    }
    setForm({ ...form, componentes: [...form.componentes, { ...novoComponente, multiplicador: Number(novoComponente.multiplicador || 1) }] });
    setNovoComponente(componenteInicial);
  }

  function removerComponente(index: number) {
    setForm({ ...form, componentes: form.componentes.filter((_, i) => i !== index) });
  }

  async function salvarProduto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("");
    const payload = {
      empresa_slug: empresaSlug,
      nome: form.nome,
      descricao: form.descricao,
      ativo: form.ativo,
      configuracao: configFromForm(form),
    };
    try {
      if (form.id) await apiPost("/api/loja/produtos/editar", { id: form.id, ...payload });
      else await apiPost("/api/loja/produtos", payload);
      setForm(produtoInicial);
      await carregarTudo();
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao salvar produto");
    }
  }

  async function excluirProduto(produto: Produto) {
    if (!window.confirm(`Excluir ${produto.nome}?`)) return;
    try {
      await apiPost("/api/loja/produtos/excluir", { empresa_slug: empresaSlug, id: produto.id });
      await carregarTudo();
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao excluir produto");
    }
  }

  async function calcularProduto() {
    if (!produtoSelecionado) {
      setMensagem("Selecione um produto");
      return;
    }
    try {
      const resultado = await apiPost<Calculo>("/api/loja/produtos/calcular", {
        empresa_slug: empresaSlug,
        produto_id: produtoSelecionado,
        quantidade: Number(quantidade || 1),
        valores,
      });
      setCalculo(resultado);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao calcular produto");
    }
  }

  async function adicionarAoOrcamento() {
    if (!produtoSelecionado || !orcamentoSelecionado) {
      setMensagem("Selecione produto e orçamento");
      return;
    }
    try {
      await apiPost("/api/loja/produtos/adicionar-orcamento", {
        empresa_slug: empresaSlug,
        produto_id: produtoSelecionado,
        orcamento_id: orcamentoSelecionado,
        quantidade: Number(quantidade || 1),
        valores,
      });
      setMensagem("Produto adicionado ao orçamento");
      await carregarTudo();
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao adicionar no orçamento");
    }
  }

  function materiaisPorCategoria(categoria?: CategoriaMaterial) {
    return materiais.filter((material) => material.ativo && (!categoria || material.categoria === categoria));
  }

  const camposMaterial = form.campos.filter((campo) => campo.tipo === "material");
  const camposNumero = form.campos.filter((campo) => campo.tipo === "numero");

  return (
    <section className="card" style={{ maxWidth: "none" }}>
      <h1>Produtos configuráveis</h1>
      <p>A empresa cria o próprio produto para orçamento. A porta de giro deixa de ser fixa: vira apenas um modelo possível de configuração.</p>
      {mensagem && <p>{mensagem}</p>}

      <section style={{ marginTop: 20 }}>
        <h2>1. Criar produto</h2>
        <button type="button" onClick={() => setForm(portaGiroModelo())}>Usar modelo editável de Porta de Giro</button>
        <form onSubmit={salvarProduto}>
          <label>Nome do produto<input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Porta de Giro, Closet, Adega" /></label>
          <label>Descrição<input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></label>
          <label>Status<select value={form.ativo ? "ativo" : "inativo"} onChange={(e) => setForm({ ...form, ativo: e.target.value === "ativo" })}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
          <label>Campo de largura<input value={form.largura_key} onChange={(e) => setForm({ ...form, largura_key: slug(e.target.value) })} /></label>
          <label>Campo de altura<input value={form.altura_key} onChange={(e) => setForm({ ...form, altura_key: slug(e.target.value) })} /></label>
          <button>{form.id ? "Salvar alterações" : "Criar produto"}</button>
          {form.id && <button type="button" onClick={() => setForm(produtoInicial)}>Cancelar edição</button>}
        </form>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>2. Campos do produto</h2>
        <div className="grid">
          <label>Chave<input value={novoCampo.chave} onChange={(e) => setNovoCampo({ ...novoCampo, chave: slug(e.target.value) })} placeholder="largura, perfil, vidro" /></label>
          <label>Rótulo<input value={novoCampo.rotulo} onChange={(e) => setNovoCampo({ ...novoCampo, rotulo: e.target.value, chave: novoCampo.chave || slug(e.target.value) })} placeholder="Largura (mm)" /></label>
          <label>Tipo<select value={novoCampo.tipo} onChange={(e) => setNovoCampo({ ...novoCampo, tipo: e.target.value as TipoCampo })}><option value="numero">Número</option><option value="texto">Texto</option><option value="material">Material</option><option value="booleano">Sim/Não</option></select></label>
          {novoCampo.tipo === "material" && <label>Categoria<select value={novoCampo.categoria || "perfil"} onChange={(e) => setNovoCampo({ ...novoCampo, categoria: e.target.value as CategoriaMaterial })}>{categorias.map((categoria) => <option key={categoria.value} value={categoria.value}>{categoria.label}</option>)}</select></label>}
          <label>Obrigatório<select value={novoCampo.obrigatorio ? "sim" : "nao"} onChange={(e) => setNovoCampo({ ...novoCampo, obrigatorio: e.target.value === "sim" })}><option value="sim">Sim</option><option value="nao">Não</option></select></label>
          <label>Valor padrão<input value={String(novoCampo.padrao || "")} onChange={(e) => setNovoCampo({ ...novoCampo, padrao: e.target.value })} /></label>
          <button type="button" onClick={adicionarCampo}>Adicionar campo</button>
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>{form.campos.map((campo) => <div className="metric" key={campo.chave}><strong>{campo.rotulo}</strong><p>{campo.chave} • {campo.tipo} • {campo.tipo === "material" ? categoriaLabel(campo.categoria) : ""} • {campo.obrigatorio ? "Obrigatório" : "Opcional"}</p><button type="button" onClick={() => removerCampo(campo.chave)}>Remover</button></div>)}{!form.campos.length && <p>Nenhum campo criado.</p>}</div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>3. Componentes de cálculo</h2>
        <p>Use a lógica antiga como blocos: perfil por perímetro, vidro por área, insumos do perfil, puxador por campo em mm, tags e valor adicional.</p>
        <div className="grid">
          <label>Nome<input value={novoComponente.nome} onChange={(e) => setNovoComponente({ ...novoComponente, nome: e.target.value })} placeholder="Perfil, Vidro, Puxador" /></label>
          <label>Origem<select value={novoComponente.origem} onChange={(e) => setNovoComponente({ ...novoComponente, origem: e.target.value as OrigemComponente })}><option value="campo_material">Material escolhido em campo</option><option value="insumos_do_material">Insumos do material</option><option value="tag_regras">Regras por tags</option><option value="valor_adicional">Valor adicional manual</option></select></label>
          {(novoComponente.origem === "campo_material" || novoComponente.origem === "insumos_do_material") && <label>Campo material<select value={novoComponente.campo_material || ""} onChange={(e) => setNovoComponente({ ...novoComponente, campo_material: e.target.value })}><option value="">Selecione</option>{camposMaterial.map((campo) => <option key={campo.chave} value={campo.chave}>{campo.rotulo}</option>)}</select></label>}
          {(novoComponente.base_quantidade === "campo_numero" || novoComponente.base_quantidade === "campo_mm_para_m" || novoComponente.origem === "valor_adicional") && <label>Campo origem<select value={novoComponente.campo_origem || ""} onChange={(e) => setNovoComponente({ ...novoComponente, campo_origem: e.target.value })}><option value="">Selecione</option>{camposNumero.map((campo) => <option key={campo.chave} value={campo.chave}>{campo.rotulo}</option>)}</select></label>}
          <label>Base da quantidade<select value={novoComponente.base_quantidade} onChange={(e) => setNovoComponente({ ...novoComponente, base_quantidade: e.target.value as BaseQuantidade })}>{bases.map((base) => <option key={base.value} value={base.value}>{base.label}</option>)}</select></label>
          <label>Multiplicador<input type="number" step="0.001" value={novoComponente.multiplicador} onChange={(e) => setNovoComponente({ ...novoComponente, multiplicador: Number(e.target.value || 1) })} /></label>
          <button type="button" onClick={adicionarComponente}>Adicionar componente</button>
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>{form.componentes.map((componente, index) => <div className="metric" key={`${componente.nome}-${index}`}><strong>{componente.nome}</strong><p>{componente.origem} • campo: {componente.campo_material || componente.campo_origem || "-"} • base: {componente.base_quantidade} • multiplicador: {componente.multiplicador}</p><button type="button" onClick={() => removerComponente(index)}>Remover</button></div>)}{!form.componentes.length && <p>Nenhum componente criado.</p>}</div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>4. Produtos cadastrados</h2>
        <div style={{ display: "grid", gap: 10 }}>{produtos.map((produto) => <div className="metric" key={produto.id}><strong>{produto.nome}</strong><p>{produto.descricao || "Sem descrição"} • {produto.ativo ? "Ativo" : "Inativo"} • {(produto.configuracao?.campos || []).length} campos • {(produto.configuracao?.componentes || []).length} componentes</p><div style={{ display: "flex", gap: 8 }}><button type="button" onClick={() => setForm(formFromProduto(produto))}>Editar</button><button type="button" onClick={() => excluirProduto(produto)}>Excluir</button></div></div>)}{!produtos.length && <p>Nenhum produto configurável cadastrado.</p>}</div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>5. Simular e adicionar ao orçamento</h2>
        <div className="grid">
          <label>Produto<select value={produtoSelecionado} onChange={(e) => setProdutoSelecionado(e.target.value)}><option value="">Selecione</option>{produtos.filter((produto) => produto.ativo).map((produto) => <option key={produto.id} value={produto.id}>{produto.nome}</option>)}</select></label>
          <label>Quantidade<input type="number" min="1" step="1" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></label>
          <label>Orçamento<select value={orcamentoSelecionado} onChange={(e) => setOrcamentoSelecionado(e.target.value)}><option value="">Selecione para adicionar</option>{orcamentos.map((orcamento) => <option key={orcamento.id} value={orcamento.id}>{orcamento.cliente_nome} • #{orcamento.numero_pedido} • {orcamento.nome_orcamento}</option>)}</select></label>
        </div>
        {produtoAtual && <div className="grid" style={{ marginTop: 16 }}>{(produtoAtual.configuracao?.campos || []).map((campo) => <label key={campo.chave}>{campo.rotulo}{campo.tipo === "material" ? <select value={valores[campo.chave] || ""} onChange={(e) => setValores({ ...valores, [campo.chave]: e.target.value })}><option value="">Selecione</option>{campo.permitir_sem_item && <option value="sem_item">Sem item</option>}{materiaisPorCategoria(campo.categoria).map((material) => <option key={material.id} value={material.id}>{material.nome} • {dinheiro(Number(material.preco_unitario))}</option>)}</select> : <input type={campo.tipo === "numero" ? "number" : "text"} value={valores[campo.chave] || ""} onChange={(e) => setValores({ ...valores, [campo.chave]: e.target.value })} />}</label>)}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}><button type="button" onClick={calcularProduto}>Calcular</button><button type="button" onClick={adicionarAoOrcamento}>Adicionar ao orçamento</button></div>
        {calculo && <div className="metric" style={{ marginTop: 16 }}><strong>{calculo.nome}: {dinheiro(calculo.valor_total)}</strong><p>Unitário: {dinheiro(calculo.valor_unitario)} • Quantidade: {calculo.quantidade}</p><div style={{ display: "grid", gap: 8, marginTop: 12 }}>{calculo.linhas.map((linha, index) => <p key={index}>{linha.nome} — {linha.material || ""}: {linha.quantidade} {linha.unidade} × {dinheiro(linha.valor_unitario)} = {dinheiro(linha.total)}</p>)}</div></div>}
      </section>
    </section>
  );
}
