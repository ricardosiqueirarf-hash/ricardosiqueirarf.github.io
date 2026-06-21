"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type CategoriaMaterial = "perfil" | "vidro" | "puxador" | "insumo" | "trilho" | "componente" | "sistema" | "outro";
type UnidadeMaterial = "unidade" | "metro_linear" | "metro_quadrado" | "kit" | "par";
type ConfiguracaoMaterial = {
  tipologias?: string[];
  insumos_ids?: string[];
  puxadores_ids?: string[];
  trilhos_ids?: string[];
  perfis_ids?: string[];
  agregados?: Record<string, string[]>;
  [key: string]: unknown;
};
type Material = {
  id: string;
  categoria: CategoriaMaterial;
  nome: string;
  codigo?: string;
  unidade: UnidadeMaterial;
  custo_unitario: number;
  margem_percentual: number;
  perda_percentual: number;
  preco_unitario: number;
  ativo: boolean;
  configuracao?: ConfiguracaoMaterial;
};
type MaterialForm = {
  id: string;
  categoria: CategoriaMaterial;
  nome: string;
  codigo: string;
  unidade: UnidadeMaterial;
  custo_unitario: string;
  margem_percentual: string;
  perda_percentual: string;
  ativo: boolean;
  tipologias: string[];
  insumos_ids: string[];
  puxadores_ids: string[];
  trilhos_ids: string[];
  perfis_ids: string[];
};

const categoriasMateriais: Array<{ value: CategoriaMaterial; label: string }> = [
  { value: "perfil", label: "Perfis" },
  { value: "sistema", label: "Sistemas" },
  { value: "vidro", label: "Vidros" },
  { value: "puxador", label: "Puxadores" },
  { value: "trilho", label: "Trilhos" },
  { value: "insumo", label: "Insumos" },
  { value: "componente", label: "Componentes" },
  { value: "outro", label: "Outros" },
];

const unidadesMateriais: Array<{ value: UnidadeMaterial; label: string }> = [
  { value: "unidade", label: "Unidade" },
  { value: "metro_linear", label: "Metro linear" },
  { value: "metro_quadrado", label: "Metro quadrado" },
  { value: "kit", label: "Kit" },
  { value: "par", label: "Par" },
];

const tipologiasPerfil = [
  { value: "giro", label: "Giro" },
  { value: "deslizante", label: "Deslizante" },
  { value: "divisao_ambiente", label: "Divisão de ambiente" },
  { value: "pivotante", label: "Pivotante" },
  { value: "estrutural", label: "Estrutural" },
  { value: "prateleiras", label: "Prateleiras" },
];

const materialInicial: MaterialForm = {
  id: "",
  categoria: "perfil",
  nome: "",
  codigo: "",
  unidade: "metro_linear",
  custo_unitario: "",
  margem_percentual: "",
  perda_percentual: "",
  ativo: true,
  tipologias: [],
  insumos_ids: [],
  puxadores_ids: [],
  trilhos_ids: [],
  perfis_ids: [],
};

function dinheiro(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
}

function numero(valor: string) {
  const n = Number(String(valor || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function precoCalculado(form: MaterialForm) {
  const custo = numero(form.custo_unitario);
  const margem = numero(form.margem_percentual);
  const perda = numero(form.perda_percentual);
  return custo * (1 + perda / 100) * (1 + margem / 100);
}

function categoriaLabel(categoria: CategoriaMaterial) {
  return categoriasMateriais.find((item) => item.value === categoria)?.label || categoria;
}

function unidadePadrao(categoria: CategoriaMaterial): UnidadeMaterial {
  if (categoria === "perfil" || categoria === "trilho") return "metro_linear";
  if (categoria === "vidro") return "metro_quadrado";
  return "unidade";
}

function unidadeLabel(unidade: UnidadeMaterial) {
  return unidadesMateriais.find((item) => item.value === unidade)?.label || unidade;
}

function tipologiaLabel(tipologia: string) {
  return tipologiasPerfil.find((item) => item.value === tipologia)?.label || tipologia;
}

function idsAgregados(config: ConfiguracaoMaterial | undefined, categoria: string) {
  return (config?.agregados?.[categoria] || []) as string[];
}

export default function MateriaisPanel({ empresaSlug }: { empresaSlug: string }) {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [categoriaAtual, setCategoriaAtual] = useState<CategoriaMaterial>("perfil");
  const [materialForm, setMaterialForm] = useState<MaterialForm>(materialInicial);
  const [mensagem, setMensagem] = useState("");

  const materiaisDaCategoria = materiais.filter((material) => material.categoria === categoriaAtual);
  const puxadores = materiais.filter((material) => material.categoria === "puxador" && material.ativo);
  const trilhos = materiais.filter((material) => material.categoria === "trilho" && material.ativo);
  const perfis = materiais.filter((material) => material.categoria === "perfil" && material.ativo);
  const insumosParaPerfil = materiais.filter((material) => ["insumo", "trilho", "componente", "outro"].includes(material.categoria) && material.ativo);
  const materialPorId = useMemo(() => new Map(materiais.map((material) => [String(material.id), material])), [materiais]);

  function nomesMateriais(ids?: string[]) {
    const nomes = (ids || []).map((id) => materialPorId.get(String(id))?.nome || String(id)).filter(Boolean);
    return nomes.length ? nomes.join(", ") : "-";
  }

  async function carregarMateriais() {
    const lista = await apiGet<Material[]>(`/api/loja/materiais?empresa_slug=${encodeURIComponent(empresaSlug)}`);
    setMateriais(lista);
  }

  useEffect(() => {
    if (empresaSlug) carregarMateriais().catch((error) => setMensagem(error instanceof Error ? error.message : "Erro ao carregar materiais"));
  }, [empresaSlug]);

  function trocarCategoria(categoria: CategoriaMaterial) {
    setCategoriaAtual(categoria);
    setMaterialForm({ ...materialInicial, categoria, unidade: unidadePadrao(categoria) });
  }

  function alternarLista(campo: "tipologias" | "insumos_ids" | "puxadores_ids" | "trilhos_ids" | "perfis_ids", valor: string) {
    setMaterialForm((atual) => {
      const lista = atual[campo];
      const novaLista = lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor];
      return { ...atual, [campo]: novaLista };
    });
  }

  function cancelarMaterial() {
    setMaterialForm({ ...materialInicial, categoria: categoriaAtual, unidade: unidadePadrao(categoriaAtual) });
  }

  function editarMaterial(material: Material) {
    const config = material.configuracao || {};
    setCategoriaAtual(material.categoria);
    setMaterialForm({
      id: material.id,
      categoria: material.categoria,
      nome: material.nome || "",
      codigo: material.codigo || "",
      unidade: material.unidade || unidadePadrao(material.categoria),
      custo_unitario: String(material.custo_unitario ?? ""),
      margem_percentual: String(material.margem_percentual ?? ""),
      perda_percentual: String(material.perda_percentual ?? ""),
      ativo: material.ativo,
      tipologias: config.tipologias || [],
      insumos_ids: config.insumos_ids || [],
      puxadores_ids: config.puxadores_ids || idsAgregados(config, "puxador"),
      trilhos_ids: config.trilhos_ids || idsAgregados(config, "trilho"),
      perfis_ids: config.perfis_ids || idsAgregados(config, "perfil"),
    });
  }

  function montarConfiguracao() {
    if (materialForm.categoria === "perfil") {
      return {
        tipologias: materialForm.tipologias,
        insumos_ids: materialForm.insumos_ids,
        puxadores_ids: materialForm.puxadores_ids,
        agregados: { puxador: materialForm.puxadores_ids },
      };
    }

    if (materialForm.categoria === "sistema") {
      return {
        trilhos_ids: materialForm.trilhos_ids,
        perfis_ids: materialForm.perfis_ids,
        agregados: {
          trilho: materialForm.trilhos_ids,
          perfil: materialForm.perfis_ids,
        },
      };
    }

    return {};
  }

  async function salvarMaterial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("");

    const payload = {
      empresa_slug: empresaSlug,
      categoria: materialForm.categoria,
      nome: materialForm.nome,
      codigo: materialForm.codigo,
      unidade: materialForm.unidade,
      custo_unitario: numero(materialForm.custo_unitario),
      margem_percentual: numero(materialForm.margem_percentual),
      perda_percentual: numero(materialForm.perda_percentual),
      ativo: materialForm.ativo,
      configuracao: montarConfiguracao(),
    };

    try {
      if (materialForm.id) {
        await apiPost("/api/loja/materiais/editar", { id: materialForm.id, ...payload });
      } else {
        await apiPost("/api/loja/materiais", payload);
      }
      cancelarMaterial();
      await carregarMateriais();
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao salvar material");
    }
  }

  async function excluirMaterial(material: Material) {
    if (!window.confirm(`Excluir ${material.nome}?`)) return;
    try {
      await apiPost("/api/loja/materiais/excluir", { empresa_slug: empresaSlug, id: material.id });
      await carregarMateriais();
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao excluir material");
    }
  }

  return (
    <section className="card" style={{ maxWidth: "none" }}>
      <h1>Materiais</h1>
      <p>Cadastro base para orçamento: sistemas, perfis, vidros, puxadores, trilhos, componentes e insumos.</p>
      {mensagem && <p>{mensagem}</p>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0" }}>
        {categoriasMateriais.map((categoria) => (
          <button key={categoria.value} type="button" onClick={() => trocarCategoria(categoria.value)} style={{ opacity: categoriaAtual === categoria.value ? 1 : 0.65 }}>
            {categoria.label}
          </button>
        ))}
      </div>

      <form onSubmit={salvarMaterial}>
        <label>Categoria<select value={materialForm.categoria} onChange={(e) => trocarCategoria(e.target.value as CategoriaMaterial)}>{categoriasMateriais.map((categoria) => <option key={categoria.value} value={categoria.value}>{categoria.label}</option>)}</select></label>
        <label>Nome<input value={materialForm.nome} onChange={(e) => setMaterialForm({ ...materialForm, nome: e.target.value })} placeholder={categoriaAtual === "sistema" ? "Ex: Sistema Deslizante Superior" : categoriaAtual === "perfil" ? "Ex: Perfil 1036 Bronze" : "Nome do material"} /></label>
        <label>Código<input value={materialForm.codigo} onChange={(e) => setMaterialForm({ ...materialForm, codigo: e.target.value })} placeholder="Opcional" /></label>
        <label>Unidade<select value={materialForm.unidade} onChange={(e) => setMaterialForm({ ...materialForm, unidade: e.target.value as UnidadeMaterial })}>{unidadesMateriais.map((unidade) => <option key={unidade.value} value={unidade.value}>{unidade.label}</option>)}</select></label>
        <label>Custo<input type="number" step="0.01" value={materialForm.custo_unitario} onChange={(e) => setMaterialForm({ ...materialForm, custo_unitario: e.target.value })} /></label>
        <label>Margem %<input type="number" step="0.01" value={materialForm.margem_percentual} onChange={(e) => setMaterialForm({ ...materialForm, margem_percentual: e.target.value })} /></label>
        <label>Perda %<input type="number" step="0.01" value={materialForm.perda_percentual} onChange={(e) => setMaterialForm({ ...materialForm, perda_percentual: e.target.value })} /></label>
        <label>Status<select value={materialForm.ativo ? "ativo" : "inativo"} onChange={(e) => setMaterialForm({ ...materialForm, ativo: e.target.value === "ativo" })}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
        <div className="metric"><strong>Preço final calculado</strong><p>{dinheiro(precoCalculado(materialForm))}</p></div>

        {materialForm.categoria === "perfil" && (
          <div style={{ gridColumn: "1 / -1", display: "grid", gap: 16 }}>
            <div><strong>Tipologias</strong><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{tipologiasPerfil.map((tipologia) => <label key={tipologia.value} style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={materialForm.tipologias.includes(tipologia.value)} onChange={() => alternarLista("tipologias", tipologia.value)} />{tipologia.label}</label>)}</div></div>
            <div><strong>Insumos usados nesse perfil</strong><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{insumosParaPerfil.length ? insumosParaPerfil.map((material) => <label key={material.id} style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={materialForm.insumos_ids.includes(material.id)} onChange={() => alternarLista("insumos_ids", material.id)} />{material.nome}</label>) : <p>Cadastre insumos, trilhos ou componentes primeiro.</p>}</div></div>
            <div><strong>Agregar puxadores compatíveis</strong><p>Ao orçar usando este perfil, só aparecerão os puxadores agregados aqui.</p><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{puxadores.length ? puxadores.map((material) => <label key={material.id} style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={materialForm.puxadores_ids.includes(material.id)} onChange={() => alternarLista("puxadores_ids", material.id)} />{material.nome}</label>) : <p>Cadastre puxadores primeiro.</p>}</div></div>
          </div>
        )}

        {materialForm.categoria === "sistema" && (
          <div style={{ gridColumn: "1 / -1", display: "grid", gap: 16 }}>
            <div><strong>Agregar trilhos compatíveis</strong><p>Ao orçar usando este sistema, só aparecerão os trilhos agregados aqui.</p><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{trilhos.length ? trilhos.map((material) => <label key={material.id} style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={materialForm.trilhos_ids.includes(material.id)} onChange={() => alternarLista("trilhos_ids", material.id)} />{material.nome}</label>) : <p>Cadastre trilhos primeiro.</p>}</div></div>
            <div><strong>Perfis compatíveis com este sistema</strong><p>Opcional. Serve para restringir quais perfis pertencem ao sistema.</p><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{perfis.length ? perfis.map((material) => <label key={material.id} style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={materialForm.perfis_ids.includes(material.id)} onChange={() => alternarLista("perfis_ids", material.id)} />{material.nome}</label>) : <p>Cadastre perfis primeiro.</p>}</div></div>
          </div>
        )}

        <button>{materialForm.id ? "Salvar alterações" : "Cadastrar material"}</button>
        {materialForm.id && <button type="button" onClick={cancelarMaterial}>Cancelar edição</button>}
      </form>

      <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
        {materiaisDaCategoria.map((material) => (
          <div className="metric" key={material.id}>
            <strong>{material.nome}</strong>
            <p>{categoriaLabel(material.categoria)} • {unidadeLabel(material.unidade)} • Custo {dinheiro(Number(material.custo_unitario))} • Margem {material.margem_percentual}% • Perda {material.perda_percentual}% • Preço {dinheiro(Number(material.preco_unitario))} • {material.ativo ? "Ativo" : "Inativo"}</p>
            {material.categoria === "perfil" && <p>Tipologias: {(material.configuracao?.tipologias || []).map(tipologiaLabel).join(", ") || "-"} • Insumos: {nomesMateriais(material.configuracao?.insumos_ids)} • Puxadores agregados: {nomesMateriais(material.configuracao?.puxadores_ids || idsAgregados(material.configuracao, "puxador"))}</p>}
            {material.categoria === "sistema" && <p>Trilhos agregados: {nomesMateriais(material.configuracao?.trilhos_ids || idsAgregados(material.configuracao, "trilho"))} • Perfis compatíveis: {nomesMateriais(material.configuracao?.perfis_ids || idsAgregados(material.configuracao, "perfil"))}</p>}
            <div style={{ display: "flex", gap: 8 }}><button type="button" onClick={() => editarMaterial(material)}>Editar</button><button type="button" onClick={() => excluirMaterial(material)}>Excluir</button></div>
          </div>
        ))}
        {!materiaisDaCategoria.length && <p>Nenhum item cadastrado em {categoriaLabel(categoriaAtual)}.</p>}
      </div>
    </section>
  );
}
