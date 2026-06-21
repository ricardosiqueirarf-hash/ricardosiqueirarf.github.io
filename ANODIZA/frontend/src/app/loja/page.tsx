"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";

type Aba = "painel" | "orcamentos" | "clientes" | "usuarios" | "ajustes" | "produtos" | "materiais";
type Permissoes = Record<Aba, boolean>;
type Usuario = { id?: string; nome?: string; email?: string; perfil?: string; permissoes?: Partial<Permissoes> };
type AuthMe = { ok: boolean; usuario: Usuario };
type Cliente = { id: string; nome: string; documento?: string; email?: string; telefone?: string };
type Orcamento = { id: string; nome_orcamento: string; cliente_nome: string; numero_pedido: string; status: string; valor_total: number; cliente_id?: string };
type CategoriaMaterial = "perfil" | "vidro" | "puxador" | "insumo" | "trilho" | "componente" | "outro";
type UnidadeMaterial = "unidade" | "metro_linear" | "metro_quadrado" | "kit" | "par";
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
  configuracao?: { tipologias?: string[]; insumos_ids?: string[]; puxadores_ids?: string[]; [key: string]: unknown };
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
};

const basePermissoes: Permissoes = { painel: true, orcamentos: true, clientes: true, usuarios: false, ajustes: false, produtos: false, materiais: false };
const masterPermissoes: Permissoes = { painel: true, orcamentos: true, clientes: true, usuarios: true, ajustes: true, produtos: true, materiais: true };
const categoriasMateriais: Array<{ value: CategoriaMaterial; label: string }> = [
  { value: "perfil", label: "Perfis" },
  { value: "vidro", label: "Vidros" },
  { value: "puxador", label: "Puxadores" },
  { value: "insumo", label: "Insumos" },
  { value: "trilho", label: "Trilhos" },
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
};

function normalizar(permissoes?: Partial<Permissoes>, perfil?: string): Permissoes {
  if (perfil === "owner") return masterPermissoes;
  return { ...basePermissoes, ...(permissoes || {}), usuarios: false };
}

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

function unidadeLabel(unidade: UnidadeMaterial) {
  return unidadesMateriais.find((item) => item.value === unidade)?.label || unidade;
}

function tipologiaLabel(tipologia: string) {
  return tipologiasPerfil.find((item) => item.value === tipologia)?.label || tipologia;
}

export default function LojaPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [empresaSlug, setEmpresaSlug] = useState("");
  const [aba, setAba] = useState<Aba>("painel");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [categoriaAtual, setCategoriaAtual] = useState<CategoriaMaterial>("perfil");
  const [materialForm, setMaterialForm] = useState<MaterialForm>(materialInicial);
  const [mensagem, setMensagem] = useState("");
  const [novoCliente, setNovoCliente] = useState({ nome: "", documento: "", email: "", telefone: "" });
  const [novoOrcamento, setNovoOrcamento] = useState({ nome_orcamento: "", cliente_id: "" });
  const [novoUsuario, setNovoUsuario] = useState({ nome: "", email: "", perfil: "vendedor", senha: "" });

  const permissoes = normalizar(usuario?.permissoes, usuario?.perfil);
  const isMaster = usuario?.perfil === "owner";
  const pode = (chave: Aba) => Boolean(permissoes[chave]);
  const materiaisDaCategoria = materiais.filter((material) => material.categoria === categoriaAtual);
  const puxadores = materiais.filter((material) => material.categoria === "puxador" && material.ativo);
  const insumosParaPerfil = materiais.filter((material) => ["insumo", "trilho", "componente", "outro"].includes(material.categoria) && material.ativo);
  const materialPorId = useMemo(() => new Map(materiais.map((material) => [String(material.id), material])), [materiais]);

  function nomesMateriais(ids?: string[]) {
    const nomes = (ids || []).map((id) => materialPorId.get(String(id))?.nome || String(id)).filter(Boolean);
    return nomes.length ? nomes.join(", ") : "-";
  }

  async function carregarClientes(slug: string) {
    const lista = await apiGet<Cliente[]>(`/api/loja/clientes?empresa_slug=${encodeURIComponent(slug)}`);
    setClientes(lista);
  }

  async function carregarOrcamentos(slug: string) {
    const params = new URLSearchParams({ empresa_slug: slug, busca: "" });
    const lista = await apiGet<Orcamento[]>(`/api/loja/orcamentos?${params.toString()}`);
    setOrcamentos(lista);
  }

  async function carregarUsuarios(slug: string) {
    if (!isMaster) return;
    const lista = await apiGet<Usuario[]>(`/api/loja/usuarios?empresa_slug=${encodeURIComponent(slug)}`);
    setUsuarios(lista);
  }

  async function carregarMateriais(slug: string) {
    const lista = await apiGet<Material[]>(`/api/loja/materiais?empresa_slug=${encodeURIComponent(slug)}`);
    setMateriais(lista);
  }

  useEffect(() => {
    async function iniciar() {
      const slug = window.localStorage.getItem("anodiza_empresa_slug") || "";
      const chave = window.localStorage.getItem("anodiza_chave_acesso") || "";
      if (!chave) { router.push("/login"); return; }
      try {
        const me = await apiGet<AuthMe>("/api/auth/me");
        setUsuario(me.usuario);
        setEmpresaSlug(slug);
        if (slug) await carregarClientes(slug);
      } catch {
        window.localStorage.removeItem("anodiza_chave_acesso");
        router.push("/login");
      } finally {
        setCarregando(false);
      }
    }
    iniciar();
  }, [router]);

  async function abrir(chave: Aba) {
    if (!pode(chave)) return;
    setAba(chave);
    if (chave === "clientes") await carregarClientes(empresaSlug);
    if (chave === "orcamentos") { await carregarClientes(empresaSlug); await carregarOrcamentos(empresaSlug); }
    if (chave === "usuarios") await carregarUsuarios(empresaSlug);
    if (chave === "materiais") await carregarMateriais(empresaSlug);
  }

  async function sair() {
    try { await apiPost("/api/auth/logout", {}); } catch {}
    window.localStorage.removeItem("anodiza_chave_acesso");
    window.localStorage.removeItem("anodiza_usuario");
    router.push("/login");
  }

  async function criarCliente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await apiPost("/api/loja/clientes", { empresa_slug: empresaSlug, ...novoCliente }); setNovoCliente({ nome: "", documento: "", email: "", telefone: "" }); await carregarClientes(empresaSlug); }
    catch (error) { setMensagem(error instanceof Error ? error.message : "Erro ao criar cliente"); }
  }

  async function criarOrcamento(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await apiPost("/api/loja/orcamentos", { empresa_slug: empresaSlug, ...novoOrcamento }); setNovoOrcamento({ nome_orcamento: "", cliente_id: "" }); await carregarOrcamentos(empresaSlug); }
    catch (error) { setMensagem(error instanceof Error ? error.message : "Erro ao criar orcamento"); }
  }

  async function criarUsuario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await apiPost("/api/loja/usuarios", { empresa_slug: empresaSlug, ...novoUsuario }); setNovoUsuario({ nome: "", email: "", perfil: "vendedor", senha: "" }); await carregarUsuarios(empresaSlug); }
    catch (error) { setMensagem(error instanceof Error ? error.message : "Erro ao criar usuario"); }
  }

  async function salvarPermissoes(alvo: Usuario, permissoesNovas: Partial<Permissoes>) {
    try { await apiPost("/api/loja/usuarios/permissoes", { empresa_slug: empresaSlug, id: alvo.id, permissoes: permissoesNovas }); await carregarUsuarios(empresaSlug); }
    catch (error) { setMensagem(error instanceof Error ? error.message : "Erro ao alterar acessos"); }
  }

  function trocarCategoria(categoria: CategoriaMaterial) {
    setCategoriaAtual(categoria);
    setMaterialForm({ ...materialInicial, categoria, unidade: categoria === "perfil" ? "metro_linear" : categoria === "vidro" ? "metro_quadrado" : "unidade" });
  }

  function alternarLista(campo: "tipologias" | "insumos_ids" | "puxadores_ids", valor: string) {
    setMaterialForm((atual) => {
      const lista = atual[campo];
      const novaLista = lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor];
      return { ...atual, [campo]: novaLista };
    });
  }

  function cancelarMaterial() {
    setMaterialForm({ ...materialInicial, categoria: categoriaAtual, unidade: categoriaAtual === "perfil" ? "metro_linear" : categoriaAtual === "vidro" ? "metro_quadrado" : "unidade" });
  }

  function editarMaterial(material: Material) {
    setCategoriaAtual(material.categoria);
    setMaterialForm({
      id: material.id,
      categoria: material.categoria,
      nome: material.nome || "",
      codigo: material.codigo || "",
      unidade: material.unidade || "unidade",
      custo_unitario: String(material.custo_unitario ?? ""),
      margem_percentual: String(material.margem_percentual ?? ""),
      perda_percentual: String(material.perda_percentual ?? ""),
      ativo: material.ativo,
      tipologias: material.configuracao?.tipologias || [],
      insumos_ids: material.configuracao?.insumos_ids || [],
      puxadores_ids: material.configuracao?.puxadores_ids || [],
    });
  }

  async function salvarMaterial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("");

    const configuracao = materialForm.categoria === "perfil" ? {
      tipologias: materialForm.tipologias,
      insumos_ids: materialForm.insumos_ids,
      puxadores_ids: materialForm.puxadores_ids,
    } : {};

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
      configuracao,
    };

    try {
      if (materialForm.id) {
        await apiPost("/api/loja/materiais/editar", { id: materialForm.id, ...payload });
      } else {
        await apiPost("/api/loja/materiais", payload);
      }
      cancelarMaterial();
      await carregarMateriais(empresaSlug);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao salvar material");
    }
  }

  async function excluirMaterial(material: Material) {
    if (!window.confirm(`Excluir ${material.nome}?`)) return;
    try {
      await apiPost("/api/loja/materiais/excluir", { empresa_slug: empresaSlug, id: material.id });
      await carregarMateriais(empresaSlug);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao excluir material");
    }
  }

  if (carregando) return <main className="dashboard"><section className="card"><h1>Carregando sessão...</h1><p>Validando usuário no backend.</p></section></main>;
  if (!usuario) return <main className="dashboard"><section className="card"><h1>Sessão inválida</h1><button onClick={() => router.push("/login")}>Entrar</button></section></main>;

  return <main className="dashboard"><aside className="sidebar"><div className="brand"><div className="brand-mark">A</div><div><strong>ANODIZA</strong><p>{usuario.nome}</p></div></div><p>Empresa: {empresaSlug}</p><nav style={{ display: "grid", gap: 10, marginTop: 24 }}>{pode("painel") && <button onClick={() => abrir("painel")}>Painel</button>}{pode("orcamentos") && <button onClick={() => abrir("orcamentos")}>Orçamentos</button>}{pode("clientes") && <button onClick={() => abrir("clientes")}>Clientes</button>}{isMaster && <button onClick={() => abrir("usuarios")}>Usuários</button>}{pode("produtos") && <button onClick={() => abrir("produtos")}>Produtos</button>}{pode("materiais") && <button onClick={() => abrir("materiais")}>Materiais</button>}{pode("ajustes") && <button onClick={() => abrir("ajustes")}>Ajustes</button>}<button onClick={sair}>Sair</button></nav></aside><section className="main">{mensagem && <p>{mensagem}</p>}
    {aba === "painel" && <section><h1>Painel da Loja</h1><p>Usuário validado pelo backend. O menu é apenas visual; o bloqueio real está na API.</p></section>}
    {aba === "clientes" && <section className="card" style={{ maxWidth: "none" }}><h1>Clientes</h1><form onSubmit={criarCliente}><label>Nome<input value={novoCliente.nome} onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })} /></label><label>CPF/CNPJ<input value={novoCliente.documento} onChange={(e) => setNovoCliente({ ...novoCliente, documento: e.target.value })} /></label><label>E-mail<input value={novoCliente.email} onChange={(e) => setNovoCliente({ ...novoCliente, email: e.target.value })} /></label><label>Celular<input value={novoCliente.telefone} onChange={(e) => setNovoCliente({ ...novoCliente, telefone: e.target.value })} /></label><button>Cadastrar</button></form>{clientes.map((c) => <div className="metric" key={c.id}><strong>{c.nome}</strong><p>{c.documento || "Sem documento"} • {c.email || "Sem e-mail"} • {c.telefone || "Sem telefone"}</p></div>)}</section>}
    {aba === "orcamentos" && <section className="card" style={{ maxWidth: "none" }}><h1>Orçamentos</h1><form onSubmit={criarOrcamento}><label>Nome<input value={novoOrcamento.nome_orcamento} onChange={(e) => setNovoOrcamento({ ...novoOrcamento, nome_orcamento: e.target.value })} /></label><label>Cliente<select value={novoOrcamento.cliente_id} onChange={(e) => setNovoOrcamento({ ...novoOrcamento, cliente_id: e.target.value })}><option value="">Selecione</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label><button>Criar</button></form>{orcamentos.map((o) => <div className="metric" key={o.id}><strong>{o.nome_orcamento}</strong><p>{o.cliente_nome} • #{o.numero_pedido} • {o.status} • {dinheiro(o.valor_total)}</p></div>)}</section>}
    {aba === "usuarios" && isMaster && <section className="card" style={{ maxWidth: "none" }}><h1>Usuários</h1><form onSubmit={criarUsuario}><label>Nome<input value={novoUsuario.nome} onChange={(e) => setNovoUsuario({ ...novoUsuario, nome: e.target.value })} /></label><label>E-mail<input value={novoUsuario.email} onChange={(e) => setNovoUsuario({ ...novoUsuario, email: e.target.value })} /></label><label>Senha inicial<input type="password" value={novoUsuario.senha} onChange={(e) => setNovoUsuario({ ...novoUsuario, senha: e.target.value })} /></label><label>Perfil<select value={novoUsuario.perfil} onChange={(e) => setNovoUsuario({ ...novoUsuario, perfil: e.target.value })}><option value="vendedor">Vendedor</option><option value="financeiro">Financeiro</option><option value="producao">Produção</option><option value="gerente">Gerente</option></select></label><button>Criar</button></form>{usuarios.map((u) => <div className="metric" key={u.id}><strong>{u.nome}</strong><p>{u.email} • {u.perfil}</p>{u.perfil === "owner" ? <p>Master com acesso total.</p> : <button onClick={() => salvarPermissoes(u, normalizar(u.permissoes, u.perfil))}>Salvar acessos atuais</button>}</div>)}</section>}
    {aba === "produtos" && <section className="card"><h1>Produtos</h1><p>Área protegida por permissão real no backend.</p></section>}
    {aba === "materiais" && <section className="card" style={{ maxWidth: "none" }}><h1>Materiais</h1><p>Cadastro base para orçamento: perfis, vidros, puxadores, trilhos, componentes e insumos.</p><div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0" }}>{categoriasMateriais.map((categoria) => <button key={categoria.value} type="button" onClick={() => trocarCategoria(categoria.value)} style={{ opacity: categoriaAtual === categoria.value ? 1 : 0.65 }}>{categoria.label}</button>)}</div><form onSubmit={salvarMaterial}><label>Categoria<select value={materialForm.categoria} onChange={(e) => trocarCategoria(e.target.value as CategoriaMaterial)}>{categoriasMateriais.map((categoria) => <option key={categoria.value} value={categoria.value}>{categoria.label}</option>)}</select></label><label>Nome<input value={materialForm.nome} onChange={(e) => setMaterialForm({ ...materialForm, nome: e.target.value })} placeholder={categoriaAtual === "perfil" ? "Ex: Perfil 1036 Bronze" : "Nome do material"} /></label><label>Código<input value={materialForm.codigo} onChange={(e) => setMaterialForm({ ...materialForm, codigo: e.target.value })} placeholder="Opcional" /></label><label>Unidade<select value={materialForm.unidade} onChange={(e) => setMaterialForm({ ...materialForm, unidade: e.target.value as UnidadeMaterial })}>{unidadesMateriais.map((unidade) => <option key={unidade.value} value={unidade.value}>{unidade.label}</option>)}</select></label><label>Custo<input type="number" step="0.01" value={materialForm.custo_unitario} onChange={(e) => setMaterialForm({ ...materialForm, custo_unitario: e.target.value })} /></label><label>Margem %<input type="number" step="0.01" value={materialForm.margem_percentual} onChange={(e) => setMaterialForm({ ...materialForm, margem_percentual: e.target.value })} /></label><label>Perda %<input type="number" step="0.01" value={materialForm.perda_percentual} onChange={(e) => setMaterialForm({ ...materialForm, perda_percentual: e.target.value })} /></label><label>Status<select value={materialForm.ativo ? "ativo" : "inativo"} onChange={(e) => setMaterialForm({ ...materialForm, ativo: e.target.value === "ativo" })}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label><div className="metric"><strong>Preço final calculado</strong><p>{dinheiro(precoCalculado(materialForm))}</p></div>{materialForm.categoria === "perfil" && <div style={{ gridColumn: "1 / -1", display: "grid", gap: 16 }}><div><strong>Tipologias</strong><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{tipologiasPerfil.map((tipologia) => <label key={tipologia.value} style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={materialForm.tipologias.includes(tipologia.value)} onChange={() => alternarLista("tipologias", tipologia.value)} />{tipologia.label}</label>)}</div></div><div><strong>Insumos usados nesse perfil</strong><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{insumosParaPerfil.length ? insumosParaPerfil.map((material) => <label key={material.id} style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={materialForm.insumos_ids.includes(material.id)} onChange={() => alternarLista("insumos_ids", material.id)} />{material.nome}</label>) : <p>Cadastre insumos, trilhos ou componentes primeiro.</p>}</div></div><div><strong>Puxadores compatíveis</strong><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{puxadores.length ? puxadores.map((material) => <label key={material.id} style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={materialForm.puxadores_ids.includes(material.id)} onChange={() => alternarLista("puxadores_ids", material.id)} />{material.nome}</label>) : <p>Cadastre puxadores primeiro.</p>}</div></div></div>}<button>{materialForm.id ? "Salvar alterações" : "Cadastrar material"}</button>{materialForm.id && <button type="button" onClick={cancelarMaterial}>Cancelar edição</button>}</form><div style={{ display: "grid", gap: 12, marginTop: 24 }}>{materiaisDaCategoria.map((material) => <div className="metric" key={material.id}><strong>{material.nome}</strong><p>{categoriaLabel(material.categoria)} • {unidadeLabel(material.unidade)} • Custo {dinheiro(Number(material.custo_unitario))} • Margem {material.margem_percentual}% • Perda {material.perda_percentual}% • Preço {dinheiro(Number(material.preco_unitario))} • {material.ativo ? "Ativo" : "Inativo"}</p>{material.categoria === "perfil" && <p>Tipologias: {(material.configuracao?.tipologias || []).map(tipologiaLabel).join(", ") || "-"} • Insumos: {nomesMateriais(material.configuracao?.insumos_ids)} • Puxadores: {nomesMateriais(material.configuracao?.puxadores_ids)}</p>}<div style={{ display: "flex", gap: 8 }}><button type="button" onClick={() => editarMaterial(material)}>Editar</button><button type="button" onClick={() => excluirMaterial(material)}>Excluir</button></div></div>)}{!materiaisDaCategoria.length && <p>Nenhum item cadastrado em {categoriaLabel(categoriaAtual)}.</p>}</div></section>}
    {aba === "ajustes" && <section className="card"><h1>Ajustes</h1><p>Área protegida por permissão real no backend.</p></section>}
  </section></main>;
}
