"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type CategoriaMaterial = "perfil" | "vidro" | "puxador" | "insumo" | "trilho" | "componente" | "outro";
type UnidadeCalculo = "unidade" | "metro_linear" | "metro_quadrado" | "kit" | "par";
type OperadorRegra = "contem_todas" | "contem_qualquer";

type Material = {
  id: string;
  categoria: CategoriaMaterial;
  nome: string;
  ativo: boolean;
};

type Tag = {
  id: string;
  nome: string;
  descricao?: string;
  categorias_aplicaveis?: CategoriaMaterial[];
  ativo: boolean;
};

type MaterialTag = {
  id: string;
  material_id: string;
  tag_id: string;
};

type RegraTag = {
  id: string;
  nome: string;
  descricao?: string;
  categoria_a: CategoriaMaterial;
  tag_ids_a: string[];
  categoria_b: CategoriaMaterial;
  tag_ids_b: string[];
  operador: OperadorRegra;
  cobranca_nome: string;
  unidade_calculo: UnidadeCalculo;
  valor_unitario: number;
  ativo: boolean;
};

type TagsPayload = {
  tags: Tag[];
  material_tags: MaterialTag[];
  regras: RegraTag[];
};

type TagForm = {
  id: string;
  nome: string;
  descricao: string;
  categorias_aplicaveis: CategoriaMaterial[];
  ativo: boolean;
};

type RegraForm = {
  id: string;
  nome: string;
  descricao: string;
  categoria_a: CategoriaMaterial;
  tag_ids_a: string[];
  categoria_b: CategoriaMaterial;
  tag_ids_b: string[];
  operador: OperadorRegra;
  cobranca_nome: string;
  unidade_calculo: UnidadeCalculo;
  valor_unitario: string;
  ativo: boolean;
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

const unidades: Array<{ value: UnidadeCalculo; label: string }> = [
  { value: "unidade", label: "Unidade" },
  { value: "metro_linear", label: "Metro linear" },
  { value: "metro_quadrado", label: "Metro quadrado" },
  { value: "kit", label: "Kit" },
  { value: "par", label: "Par" },
];

const tagInicial: TagForm = { id: "", nome: "", descricao: "", categorias_aplicaveis: [], ativo: true };
const regraInicial: RegraForm = {
  id: "",
  nome: "",
  descricao: "",
  categoria_a: "vidro",
  tag_ids_a: [],
  categoria_b: "perfil",
  tag_ids_b: [],
  operador: "contem_todas",
  cobranca_nome: "",
  unidade_calculo: "metro_linear",
  valor_unitario: "",
  ativo: true,
};

function dinheiro(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
}

function numero(valor: string) {
  const n = Number(String(valor || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function categoriaLabel(categoria: CategoriaMaterial) {
  return categorias.find((item) => item.value === categoria)?.label || categoria;
}

function unidadeLabel(unidade: UnidadeCalculo) {
  return unidades.find((item) => item.value === unidade)?.label || unidade;
}

function listaToggle<T extends string>(lista: T[], valor: T) {
  return lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor];
}

export default function TagsPanel({ empresaSlug }: { empresaSlug: string }) {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [materialTags, setMaterialTags] = useState<MaterialTag[]>([]);
  const [regras, setRegras] = useState<RegraTag[]>([]);
  const [tagForm, setTagForm] = useState<TagForm>(tagInicial);
  const [regraForm, setRegraForm] = useState<RegraForm>(regraInicial);
  const [materialSelecionado, setMaterialSelecionado] = useState("");
  const [tagsSelecionadasMaterial, setTagsSelecionadasMaterial] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState("");

  const tagPorId = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);

  async function carregarTudo() {
    if (!empresaSlug) return;
    const [materiaisLista, tagsData] = await Promise.all([
      apiGet<Material[]>(`/api/loja/materiais?empresa_slug=${encodeURIComponent(empresaSlug)}`),
      apiGet<TagsPayload>(`/api/loja/tags?empresa_slug=${encodeURIComponent(empresaSlug)}`),
    ]);
    setMateriais(materiaisLista);
    setTags(tagsData.tags || []);
    setMaterialTags(tagsData.material_tags || []);
    setRegras(tagsData.regras || []);
  }

  useEffect(() => {
    carregarTudo().catch((error) => setMensagem(error instanceof Error ? error.message : "Erro ao carregar tags"));
  }, [empresaSlug]);

  useEffect(() => {
    const ids = materialTags.filter((item) => item.material_id === materialSelecionado).map((item) => item.tag_id);
    setTagsSelecionadasMaterial(ids);
  }, [materialSelecionado, materialTags]);

  function tagsPorCategoria(categoria: CategoriaMaterial) {
    return tags.filter((tag) => {
      if (!tag.ativo) return false;
      const cats = tag.categorias_aplicaveis || [];
      return cats.length === 0 || cats.includes(categoria);
    });
  }

  function nomesTags(ids?: string[]) {
    const nomes = (ids || []).map((id) => tagPorId.get(id)?.nome || id).filter(Boolean);
    return nomes.length ? nomes.join(", ") : "Qualquer característica";
  }

  function materiaisComTags(material: Material) {
    const ids = materialTags.filter((item) => item.material_id === material.id).map((item) => item.tag_id);
    return nomesTags(ids).replace("Qualquer característica", "Sem tags");
  }

  async function salvarTag(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("");
    const payload = { empresa_slug: empresaSlug, ...tagForm };

    try {
      if (tagForm.id) {
        await apiPost("/api/loja/tags/editar", payload);
      } else {
        await apiPost("/api/loja/tags", payload);
      }
      setTagForm(tagInicial);
      await carregarTudo();
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao salvar tag");
    }
  }

  async function excluirTag(tag: Tag) {
    if (!window.confirm(`Excluir a tag ${tag.nome}?`)) return;
    try {
      await apiPost("/api/loja/tags/excluir", { empresa_slug: empresaSlug, id: tag.id });
      await carregarTudo();
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao excluir tag");
    }
  }

  async function salvarTagsMaterial() {
    if (!materialSelecionado) {
      setMensagem("Selecione um material");
      return;
    }
    try {
      await apiPost("/api/loja/tags/material", { empresa_slug: empresaSlug, material_id: materialSelecionado, tag_ids: tagsSelecionadasMaterial });
      await carregarTudo();
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao salvar tags do material");
    }
  }

  async function salvarRegra(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("");
    const payload = {
      empresa_slug: empresaSlug,
      ...regraForm,
      valor_unitario: numero(regraForm.valor_unitario),
    };

    try {
      if (regraForm.id) {
        await apiPost("/api/loja/tags/regras/editar", payload);
      } else {
        await apiPost("/api/loja/tags/regras", payload);
      }
      setRegraForm(regraInicial);
      await carregarTudo();
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao salvar regra");
    }
  }

  async function excluirRegra(regra: RegraTag) {
    if (!window.confirm(`Excluir a regra ${regra.nome}?`)) return;
    try {
      await apiPost("/api/loja/tags/regras/excluir", { empresa_slug: empresaSlug, id: regra.id });
      await carregarTudo();
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao excluir regra");
    }
  }

  return (
    <section className="card" style={{ maxWidth: "none" }}>
      <h1>Tags e regras de negócio</h1>
      <p>Crie características para materiais e regras que cruzam dois grupos de materiais para gerar cobranças automáticas.</p>
      {mensagem && <p>{mensagem}</p>}

      <section style={{ marginTop: 20 }}>
        <h2>1. Características</h2>
        <form onSubmit={salvarTag}>
          <label>Nome da tag<input value={tagForm.nome} onChange={(e) => setTagForm({ ...tagForm, nome: e.target.value })} placeholder="Ex: Translúcido, Bronze, Premium" /></label>
          <label>Descrição<input value={tagForm.descricao} onChange={(e) => setTagForm({ ...tagForm, descricao: e.target.value })} placeholder="Opcional" /></label>
          <label>Status<select value={tagForm.ativo ? "ativo" : "inativo"} onChange={(e) => setTagForm({ ...tagForm, ativo: e.target.value === "ativo" })}><option value="ativo">Ativa</option><option value="inativo">Inativa</option></select></label>
          <div style={{ gridColumn: "1 / -1" }}><strong>Aplicável em</strong><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{categorias.map((categoria) => <label key={categoria.value} style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={tagForm.categorias_aplicaveis.includes(categoria.value)} onChange={() => setTagForm({ ...tagForm, categorias_aplicaveis: listaToggle(tagForm.categorias_aplicaveis, categoria.value) })} />{categoria.label}</label>)}</div><p>Sem marcar nenhuma categoria = tag livre para qualquer material.</p></div>
          <button>{tagForm.id ? "Salvar tag" : "Criar tag"}</button>{tagForm.id && <button type="button" onClick={() => setTagForm(tagInicial)}>Cancelar edição</button>}
        </form>
        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>{tags.map((tag) => <div className="metric" key={tag.id}><strong>{tag.nome}</strong><p>{tag.descricao || "Sem descrição"} • {(tag.categorias_aplicaveis || []).map(categoriaLabel).join(", ") || "Todas as categorias"} • {tag.ativo ? "Ativa" : "Inativa"}</p><div style={{ display: "flex", gap: 8 }}><button type="button" onClick={() => setTagForm({ id: tag.id, nome: tag.nome, descricao: tag.descricao || "", categorias_aplicaveis: tag.categorias_aplicaveis || [], ativo: tag.ativo })}>Editar</button><button type="button" onClick={() => excluirTag(tag)}>Excluir</button></div></div>)}{!tags.length && <p>Nenhuma tag cadastrada.</p>}</div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>2. Tags por material</h2>
        <label>Material<select value={materialSelecionado} onChange={(e) => setMaterialSelecionado(e.target.value)}><option value="">Selecione</option>{materiais.map((material) => <option key={material.id} value={material.id}>{categoriaLabel(material.categoria)} — {material.nome}</option>)}</select></label>
        {materialSelecionado && <div style={{ marginTop: 12 }}><strong>Características do material</strong><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{tagsPorCategoria(materiais.find((m) => m.id === materialSelecionado)?.categoria || "outro").map((tag) => <label key={tag.id} style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={tagsSelecionadasMaterial.includes(tag.id)} onChange={() => setTagsSelecionadasMaterial(listaToggle(tagsSelecionadasMaterial, tag.id))} />{tag.nome}</label>)}</div><button type="button" onClick={salvarTagsMaterial} style={{ marginTop: 12 }}>Salvar tags do material</button></div>}
        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>{materiais.map((material) => <div className="metric" key={material.id}><strong>{material.nome}</strong><p>{categoriaLabel(material.categoria)} • {materiaisComTags(material)}</p></div>)}</div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>3. Regras de negócio por tags</h2>
        <p>Exemplo: Vidro com tag “Translúcido” + qualquer Perfil = cobrar “Pintura da borda” por metro linear.</p>
        <form onSubmit={salvarRegra}>
          <label>Nome da regra<input value={regraForm.nome} onChange={(e) => setRegraForm({ ...regraForm, nome: e.target.value })} placeholder="Ex: Pintura da borda em vidro translúcido" /></label>
          <label>Descrição<input value={regraForm.descricao} onChange={(e) => setRegraForm({ ...regraForm, descricao: e.target.value })} placeholder="Opcional" /></label>
          <label>Material A<select value={regraForm.categoria_a} onChange={(e) => setRegraForm({ ...regraForm, categoria_a: e.target.value as CategoriaMaterial, tag_ids_a: [] })}>{categorias.map((categoria) => <option key={categoria.value} value={categoria.value}>{categoria.label}</option>)}</select></label>
          <label>Material B<select value={regraForm.categoria_b} onChange={(e) => setRegraForm({ ...regraForm, categoria_b: e.target.value as CategoriaMaterial, tag_ids_b: [] })}>{categorias.map((categoria) => <option key={categoria.value} value={categoria.value}>{categoria.label}</option>)}</select></label>
          <label>Operador<select value={regraForm.operador} onChange={(e) => setRegraForm({ ...regraForm, operador: e.target.value as OperadorRegra })}><option value="contem_todas">Contém todas as tags escolhidas</option><option value="contem_qualquer">Contém qualquer uma das tags escolhidas</option></select></label>
          <label>Nome da cobrança<input value={regraForm.cobranca_nome} onChange={(e) => setRegraForm({ ...regraForm, cobranca_nome: e.target.value })} placeholder="Ex: Pintura da borda" /></label>
          <label>Unidade de cálculo<select value={regraForm.unidade_calculo} onChange={(e) => setRegraForm({ ...regraForm, unidade_calculo: e.target.value as UnidadeCalculo })}>{unidades.map((unidade) => <option key={unidade.value} value={unidade.value}>{unidade.label}</option>)}</select></label>
          <label>Valor unitário<input type="number" step="0.01" value={regraForm.valor_unitario} onChange={(e) => setRegraForm({ ...regraForm, valor_unitario: e.target.value })} /></label>
          <label>Status<select value={regraForm.ativo ? "ativo" : "inativo"} onChange={(e) => setRegraForm({ ...regraForm, ativo: e.target.value === "ativo" })}><option value="ativo">Ativa</option><option value="inativo">Inativa</option></select></label>
          <div style={{ gridColumn: "1 / -1", display: "grid", gap: 16 }}><div><strong>Tags do Material A ({categoriaLabel(regraForm.categoria_a)})</strong><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{tagsPorCategoria(regraForm.categoria_a).map((tag) => <label key={tag.id} style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={regraForm.tag_ids_a.includes(tag.id)} onChange={() => setRegraForm({ ...regraForm, tag_ids_a: listaToggle(regraForm.tag_ids_a, tag.id) })} />{tag.nome}</label>)}</div><p>Nenhuma tag marcada = qualquer característica.</p></div><div><strong>Tags do Material B ({categoriaLabel(regraForm.categoria_b)})</strong><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{tagsPorCategoria(regraForm.categoria_b).map((tag) => <label key={tag.id} style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={regraForm.tag_ids_b.includes(tag.id)} onChange={() => setRegraForm({ ...regraForm, tag_ids_b: listaToggle(regraForm.tag_ids_b, tag.id) })} />{tag.nome}</label>)}</div><p>Nenhuma tag marcada = qualquer característica.</p></div></div>
          <button>{regraForm.id ? "Salvar regra" : "Criar regra"}</button>{regraForm.id && <button type="button" onClick={() => setRegraForm(regraInicial)}>Cancelar edição</button>}
        </form>
        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>{regras.map((regra) => <div className="metric" key={regra.id}><strong>{regra.nome}</strong><p>{categoriaLabel(regra.categoria_a)} [{nomesTags(regra.tag_ids_a)}] + {categoriaLabel(regra.categoria_b)} [{nomesTags(regra.tag_ids_b)}]</p><p>Cobrança: {regra.cobranca_nome || regra.nome} • {dinheiro(Number(regra.valor_unitario))} por {unidadeLabel(regra.unidade_calculo)} • {regra.ativo ? "Ativa" : "Inativa"}</p><div style={{ display: "flex", gap: 8 }}><button type="button" onClick={() => setRegraForm({ id: regra.id, nome: regra.nome, descricao: regra.descricao || "", categoria_a: regra.categoria_a, tag_ids_a: regra.tag_ids_a || [], categoria_b: regra.categoria_b, tag_ids_b: regra.tag_ids_b || [], operador: regra.operador, cobranca_nome: regra.cobranca_nome || "", unidade_calculo: regra.unidade_calculo, valor_unitario: String(regra.valor_unitario ?? ""), ativo: regra.ativo })}>Editar</button><button type="button" onClick={() => excluirRegra(regra)}>Excluir</button></div></div>)}{!regras.length && <p>Nenhuma regra cadastrada.</p>}</div>
      </section>
    </section>
  );
}
