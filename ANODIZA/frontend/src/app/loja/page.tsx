"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type Usuario = { id: string; nome: string; email: string; perfil: string; ativo?: boolean };
type Cliente = { id: string; nome: string; documento?: string; email?: string; telefone?: string; ativo?: boolean };
type Orcamento = { id: string; cliente_id?: string; cliente_nome: string; numero_pedido: string; nome_orcamento: string; status: string; valor_total: number; created_at?: string };
type ProdutoOrcamento = { id: string; nome: string; quantidade: number; valor_unitario: number; valor_total: number };
type LojaIndex = { titulo: string; cards: { label: string; valor: number }[] };
type Aba = "painel" | "orcamentos" | "clientes" | "usuarios" | "ajustes" | "produtos" | "materiais";
type Tema = "dark" | "light";
type ClienteForm = { id?: string; nome: string; documento: string; email: string; telefone: string };
type CategoriaMaterial = "vidros" | "perfis" | "puxadores" | "sistemas" | "trilhos" | "insumos";
type OpcaoSistema = "porta_giro" | "porta_deslizante" | "porta_basculante" | "produtos_orcamento" | "aprovacao_pedido";

const fallbackIndex: LojaIndex = {
  titulo: "Painel da Loja",
  cards: [
    { label: "Orcamentos", valor: 0 },
    { label: "Aprovados", valor: 0 },
    { label: "Em producao", valor: 0 },
  ],
};

const clienteVazio: ClienteForm = { nome: "", documento: "", email: "", telefone: "" };
const produtoVazio = { nome: "", quantidade: "1", valor_unitario: "" };

const categoriasMateriais: { chave: CategoriaMaterial; titulo: string }[] = [
  { chave: "vidros", titulo: "Vidros" },
  { chave: "perfis", titulo: "Perfis" },
  { chave: "puxadores", titulo: "Puxadores" },
  { chave: "sistemas", titulo: "Sistemas" },
  { chave: "trilhos", titulo: "Trilhos" },
  { chave: "insumos", titulo: "Insumos" },
];

const produtosPortas = [
  { tipo: "sliding", titulo: "Porta Deslizante", descricao: "Modelo para portas de correr com trilho, roldanas e perfis." },
  { tipo: "swing", titulo: "Porta de Giro", descricao: "Modelo para portas de abrir com dobradicas e puxador." },
  { tipo: "tilt", titulo: "Porta Basculante", descricao: "Modelo para portas basculantes com sistema de abertura superior." },
];

const opcoesPadrao: Record<OpcaoSistema, boolean> = {
  porta_giro: true,
  porta_deslizante: true,
  porta_basculante: true,
  produtos_orcamento: true,
  aprovacao_pedido: true,
};

const listaOpcoesSistema: { chave: OpcaoSistema; titulo: string; descricao: string }[] = [
  { chave: "porta_giro", titulo: "Calculo para portas de giro", descricao: "Habilita ou desabilita o modelo pre-pronto de calculo para portas de giro." },
  { chave: "porta_deslizante", titulo: "Calculo para portas deslizantes", descricao: "Habilita ou desabilita o calculo de portas deslizantes, trilhos e sistemas." },
  { chave: "porta_basculante", titulo: "Calculo para portas basculantes", descricao: "Habilita ou desabilita o calculo de portas basculantes." },
  { chave: "produtos_orcamento", titulo: "Produtos no orcamento", descricao: "Controla se a loja pode cadastrar produtos dentro do orcamento." },
  { chave: "aprovacao_pedido", titulo: "Aprovacao de pedido", descricao: "Controla se o botao de aprovacao aparece nos orcamentos." },
];

function formatarValor(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
}

function botaoAba(ativa: boolean) {
  return { background: ativa ? "var(--primary)" : "var(--background)", color: ativa ? "#111827" : "var(--text)", border: "1px solid var(--border)" };
}

function materialTitulo(chave: CategoriaMaterial) {
  return categoriasMateriais.find((categoria) => categoria.chave === chave)?.titulo || "Materiais";
}

function Porta3D({ tipo }: { tipo: string }) {
  return (
    <div className={`door-visual ${tipo}`}>
      <div className="door-frame"><div className="door-glass" /><div className="door-handle" /></div>
      {tipo === "sliding" && <div className="door-frame"><div className="door-glass" /><div className="door-handle" /></div>}
      <div className="door-track" />
    </div>
  );
}

export default function LojaPage() {
  const [abaAtiva, setAbaAtiva] = useState<Aba>("painel");
  const [tema, setTema] = useState<Tema>("dark");
  const [logoMarca, setLogoMarca] = useState("");
  const [categoriaMaterial, setCategoriaMaterial] = useState<CategoriaMaterial>("vidros");
  const [opcoesSistema, setOpcoesSistema] = useState<Record<OpcaoSistema, boolean>>(opcoesPadrao);
  const [data, setData] = useState<LojaIndex>(fallbackIndex);
  const [empresaSlug, setEmpresaSlug] = useState("");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [produtos, setProdutos] = useState<ProdutoOrcamento[]>([]);
  const [buscaOrcamento, setBuscaOrcamento] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [mensagemClientes, setMensagemClientes] = useState("");
  const [mensagemOrcamentos, setMensagemOrcamentos] = useState("");
  const [mensagemNovoOrcamento, setMensagemNovoOrcamento] = useState("");
  const [mensagemProduto, setMensagemProduto] = useState("");
  const [mensagemLogo, setMensagemLogo] = useState("");
  const [novoUsuario, setNovoUsuario] = useState({ nome: "", email: "", perfil: "vendedor" });
  const [novoCliente, setNovoCliente] = useState<ClienteForm>(clienteVazio);
  const [clienteEditando, setClienteEditando] = useState<ClienteForm | null>(null);
  const [novoOrcamento, setNovoOrcamento] = useState({ nome_orcamento: "", cliente_id: "" });
  const [orcamentoEditando, setOrcamentoEditando] = useState<{ id: string; nome_orcamento: string; cliente_id: string } | null>(null);
  const [orcamentoProdutos, setOrcamentoProdutos] = useState<Orcamento | null>(null);
  const [produtoForm, setProdutoForm] = useState(produtoVazio);

  async function carregarClientes(slug: string) {
    if (!slug) return;
    try {
      const lista = await apiGet<Cliente[]>(`/api/loja/clientes?empresa_slug=${encodeURIComponent(slug)}`);
      setClientes(lista);
      setNovoOrcamento((current) => current.cliente_id || !lista[0] ? current : { ...current, cliente_id: lista[0].id });
    } catch { setClientes([]); }
  }

  async function carregarUsuarios(slug: string) {
    if (!slug) return;
    try { const lista = await apiGet<Usuario[]>(`/api/loja/usuarios?empresa_slug=${encodeURIComponent(slug)}`); setUsuarios(lista); }
    catch { setUsuarios([]); }
  }

  async function carregarOrcamentos(slug: string, busca = buscaOrcamento) {
    if (!slug) return;
    setMensagemOrcamentos("Carregando orcamentos...");
    try { const params = new URLSearchParams({ empresa_slug: slug, busca }); const lista = await apiGet<Orcamento[]>(`/api/loja/orcamentos?${params.toString()}`); setOrcamentos(lista); setMensagemOrcamentos(lista.length ? "" : "Nenhum orcamento encontrado."); }
    catch (error) { const detalhe = error instanceof Error ? error.message : "Erro desconhecido"; setOrcamentos([]); setMensagemOrcamentos(`Nao foi possivel carregar os orcamentos. ${detalhe}`); }
  }

  async function carregarProdutos(orcamentoId: string) {
    if (!empresaSlug || !orcamentoId) return;
    setMensagemProduto("Carregando produtos...");
    try { const params = new URLSearchParams({ empresa_slug: empresaSlug, orcamento_id: orcamentoId }); const lista = await apiGet<ProdutoOrcamento[]>(`/api/loja/orcamentos/produtos?${params.toString()}`); setProdutos(lista); setMensagemProduto(lista.length ? "" : "Nenhum produto cadastrado neste orcamento."); }
    catch (error) { const detalhe = error instanceof Error ? error.message : "Erro desconhecido"; setProdutos([]); setMensagemProduto(`Nao foi possivel carregar produtos. ${detalhe}`); }
  }

  useEffect(() => {
    const slug = localStorage.getItem("anodiza_empresa_slug") || "";
    const temaSalvo = localStorage.getItem("anodiza_tema") === "light" ? "light" : "dark";
    const logoSalva = localStorage.getItem("anodiza_logo") || "";
    const opcoesSalvas = localStorage.getItem("anodiza_opcoes_sistema");
    setTema(temaSalvo);
    setLogoMarca(logoSalva);
    if (opcoesSalvas) { try { setOpcoesSistema({ ...opcoesPadrao, ...(JSON.parse(opcoesSalvas) as Partial<Record<OpcaoSistema, boolean>>) }); } catch { setOpcoesSistema(opcoesPadrao); } }
    setEmpresaSlug(slug);
    apiGet<LojaIndex>("/api/loja/index").then(setData).catch(() => setData(fallbackIndex));
    carregarClientes(slug);
    carregarUsuarios(slug);
  }, []);

  function alterarTema(novoTema: Tema) { setTema(novoTema); localStorage.setItem("anodiza_tema", novoTema); }
  function alternarOpcao(chave: OpcaoSistema) { setOpcoesSistema((current) => { const next = { ...current, [chave]: !current[chave] }; localStorage.setItem("anodiza_opcoes_sistema", JSON.stringify(next)); return next; }); }
  function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const value = String(reader.result || ""); setLogoMarca(value); localStorage.setItem("anodiza_logo", value); setMensagemLogo("Logo atualizada. Ela substituirá o A do menu."); }; reader.readAsDataURL(file); }
  function removerLogo() { setLogoMarca(""); localStorage.removeItem("anodiza_logo"); setMensagemLogo("Logo removida. O A voltou a aparecer."); }
  async function abrirAbaClientes() { setAbaAtiva("clientes"); await carregarClientes(empresaSlug); }
  async function abrirAbaUsuarios() { setAbaAtiva("usuarios"); await carregarUsuarios(empresaSlug); }
  async function abrirAbaOrcamentos() { setAbaAtiva("orcamentos"); await carregarClientes(empresaSlug); await carregarOrcamentos(empresaSlug); }
  function abrirProdutos() { setAbaAtiva("produtos"); }
  function abrirMateriais(chave: CategoriaMaterial = categoriaMaterial) { setCategoriaMaterial(chave); setAbaAtiva("materiais"); }
  async function handleBuscarOrcamentos(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); await carregarOrcamentos(empresaSlug, buscaOrcamento); }

  async function handleCriarCliente(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!empresaSlug) return setMensagemClientes("Entre novamente para identificar a empresa."); if (!novoCliente.nome.trim()) return setMensagemClientes("Informe o nome do cliente."); setMensagemClientes("Cadastrando cliente..."); try { await apiPost("/api/loja/clientes", { empresa_slug: empresaSlug, ...novoCliente }); setNovoCliente(clienteVazio); setMensagemClientes("Cliente cadastrado."); await carregarClientes(empresaSlug); } catch (error) { setMensagemClientes(`Nao foi possivel cadastrar o cliente. ${error instanceof Error ? error.message : "Erro desconhecido"}`); } }
  async function handleEditarCliente(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!clienteEditando) return; if (!clienteEditando.nome.trim()) return setMensagemClientes("Informe o nome do cliente."); setMensagemClientes("Salvando cliente..."); try { await apiPost("/api/loja/clientes/editar", { empresa_slug: empresaSlug, ...clienteEditando }); setClienteEditando(null); setMensagemClientes("Cliente atualizado."); await carregarClientes(empresaSlug); await carregarOrcamentos(empresaSlug, buscaOrcamento); } catch (error) { setMensagemClientes(`Nao foi possivel editar o cliente. ${error instanceof Error ? error.message : "Erro desconhecido"}`); } }
  function iniciarEdicaoCliente(cliente: Cliente) { setClienteEditando({ id: cliente.id, nome: cliente.nome || "", documento: cliente.documento || "", email: cliente.email || "", telefone: cliente.telefone || "" }); setMensagemClientes(""); }

  async function handleCriarOrcamento(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!empresaSlug) return setMensagemNovoOrcamento("Entre novamente para identificar a empresa."); if (!novoOrcamento.nome_orcamento.trim()) return setMensagemNovoOrcamento("Informe o nome do orcamento."); if (!novoOrcamento.cliente_id) return setMensagemNovoOrcamento("Selecione o cliente."); setMensagemNovoOrcamento("Criando orcamento..."); try { await apiPost("/api/loja/orcamentos", { empresa_slug: empresaSlug, ...novoOrcamento }); setNovoOrcamento((current) => ({ nome_orcamento: "", cliente_id: current.cliente_id })); setMensagemNovoOrcamento("Orcamento criado com numeracao automatica do cliente."); await carregarOrcamentos(empresaSlug, buscaOrcamento); } catch (error) { setMensagemNovoOrcamento(`Nao foi possivel criar o orcamento. ${error instanceof Error ? error.message : "Erro desconhecido"}`); } }
  function abrirEditarOrcamento(orcamento: Orcamento) { setOrcamentoEditando({ id: orcamento.id, nome_orcamento: orcamento.nome_orcamento, cliente_id: orcamento.cliente_id || "" }); setOrcamentoProdutos(null); }
  async function handleEditarOrcamento(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!orcamentoEditando) return; setMensagemOrcamentos("Salvando orcamento..."); try { await apiPost("/api/loja/orcamentos/editar", { empresa_slug: empresaSlug, ...orcamentoEditando }); setOrcamentoEditando(null); setMensagemOrcamentos("Orcamento atualizado."); await carregarOrcamentos(empresaSlug, buscaOrcamento); } catch (error) { setMensagemOrcamentos(`Nao foi possivel editar o orcamento. ${error instanceof Error ? error.message : "Erro desconhecido"}`); } }
  async function handleAprovarOrcamento(orcamento: Orcamento) { if (typeof window !== "undefined" && !window.confirm(`Aprovar o pedido ${orcamento.nome_orcamento}?`)) return; setMensagemOrcamentos("Aprovando pedido..."); try { await apiPost("/api/loja/orcamentos/aprovar", { empresa_slug: empresaSlug, id: orcamento.id }); setMensagemOrcamentos("Pedido aprovado."); await carregarOrcamentos(empresaSlug, buscaOrcamento); } catch (error) { setMensagemOrcamentos(`Nao foi possivel aprovar o pedido. ${error instanceof Error ? error.message : "Erro desconhecido"}`); } }
  async function abrirProdutosOrcamento(orcamento: Orcamento) { setOrcamentoProdutos(orcamento); setOrcamentoEditando(null); setProdutoForm(produtoVazio); await carregarProdutos(orcamento.id); }
  async function handleCadastrarProduto(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!orcamentoProdutos) return; if (!produtoForm.nome.trim()) return setMensagemProduto("Informe o nome do produto."); setMensagemProduto("Cadastrando produto..."); try { await apiPost("/api/loja/orcamentos/produtos", { empresa_slug: empresaSlug, orcamento_id: orcamentoProdutos.id, ...produtoForm }); setProdutoForm(produtoVazio); setMensagemProduto("Produto cadastrado."); await carregarProdutos(orcamentoProdutos.id); await carregarOrcamentos(empresaSlug, buscaOrcamento); } catch (error) { setMensagemProduto(`Nao foi possivel cadastrar o produto. ${error instanceof Error ? error.message : "Erro desconhecido"}`); } }
  async function handleCriarUsuario(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!empresaSlug) return setMensagem("Entre novamente para identificar a empresa."); setMensagem("Criando usuario..."); try { await apiPost("/api/loja/usuarios", { empresa_slug: empresaSlug, ...novoUsuario }); setNovoUsuario({ nome: "", email: "", perfil: "vendedor" }); setMensagem("Usuario criado."); await carregarUsuarios(empresaSlug); } catch (error) { setMensagem(`Nao foi possivel criar o usuario. ${error instanceof Error ? error.message : "Erro desconhecido"}`); } }

  return (
    <main className={`dashboard theme-${tema}`}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">{logoMarca ? <img src={logoMarca} alt="Logo da loja" /> : "A"}</div><div><strong>ANODIZA</strong><p>Loja</p></div></div>
        <p>Empresa ativa: {empresaSlug || "nao identificada"}</p>
        <nav style={{ display: "grid", gap: 10, marginTop: 28 }}>
          <button type="button" onClick={() => setAbaAtiva("painel")} style={botaoAba(abaAtiva === "painel")}>Painel</button>
          <button type="button" onClick={abrirAbaOrcamentos} style={botaoAba(abaAtiva === "orcamentos")}>Orcamentos</button>
          <button type="button" onClick={abrirAbaClientes} style={botaoAba(abaAtiva === "clientes")}>Clientes</button>
          <button type="button" onClick={abrirAbaUsuarios} style={botaoAba(abaAtiva === "usuarios")}>Usuarios</button>
          <button type="button" onClick={() => setAbaAtiva("ajustes")} style={botaoAba(abaAtiva === "ajustes")}>Ajustes</button>
          <button type="button" onClick={abrirProdutos} style={botaoAba(abaAtiva === "produtos")}>Produtos</button>
          <button type="button" onClick={() => abrirMateriais()} style={botaoAba(abaAtiva === "materiais")}>Cadastro de materiais</button>
          {abaAtiva === "materiais" && <div style={{ display: "grid", gap: 8, paddingLeft: 12 }}>{categoriasMateriais.map((categoria) => <button key={categoria.chave} type="button" onClick={() => abrirMateriais(categoria.chave)} style={botaoAba(categoriaMaterial === categoria.chave)}>{categoria.titulo}</button>)}</div>}
        </nav>
      </aside>

      <section className="main">
        {abaAtiva === "painel" && <><h1>{data.titulo}</h1><p>Visao geral da loja ativa.</p><div className="grid">{data.cards.map((card) => <div className="metric" key={card.label}><p>{card.label}</p><strong>{card.valor}</strong></div>)}</div></>}

        {abaAtiva === "produtos" && <section className="card" style={{ maxWidth: "none" }}><h1>Produtos</h1><p>Configure os produtos que poderao ser orcados dentro dos orcamentos.</p><h2 style={{ marginTop: 28 }}>• Portas</h2><div className="metric" style={{ marginTop: 18, padding: 0, overflow: "hidden" }}><div style={{ padding: "26px 26px 20px" }}><strong style={{ fontSize: 22 }}>Portas de Aluminio e Vidro</strong><p style={{ marginTop: 8 }}>Giro, deslizante e basculante sao escolhidas dentro da tela de produtos.</p></div><div className="door-products" style={{ padding: 22, marginTop: 0 }}>{produtosPortas.map((produto) => <div className="door-card" key={produto.tipo}><div className="door-stage"><Porta3D tipo={produto.tipo} /></div><div className="door-body"><strong>{produto.titulo}</strong><p>{produto.descricao}</p><button type="button" style={{ marginTop: 16 }}>Configurar produto</button></div></div>)}</div></div></section>}

        {abaAtiva === "orcamentos" && <section className="card" style={{ maxWidth: "none" }}><h1>Orcamentos</h1><p>Use os icones da lista para produtos, edicao e aprovacao do pedido.</p><div className="metric" style={{ marginTop: 18 }}><strong style={{ fontSize: 18 }}>Criar orcamento</strong><form onSubmit={handleCriarOrcamento} style={{ marginTop: 14 }}><label>Nome do orcamento<input value={novoOrcamento.nome_orcamento} onChange={(event) => setNovoOrcamento((current) => ({ ...current, nome_orcamento: event.target.value }))} /></label><label>Cliente<select value={novoOrcamento.cliente_id} onChange={(event) => setNovoOrcamento((current) => ({ ...current, cliente_id: event.target.value }))}><option value="">Selecione o cliente</option>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}</select></label><button type="submit">Criar orcamento</button></form>{mensagemNovoOrcamento && <p style={{ marginTop: 12 }}>{mensagemNovoOrcamento}</p>}{!clientes.length && <p style={{ marginTop: 12 }}>Cadastre um cliente antes de criar orcamentos.</p>}</div>{orcamentoEditando && <div className="metric" style={{ marginTop: 18 }}><strong style={{ fontSize: 18 }}>Editar orcamento</strong><form onSubmit={handleEditarOrcamento} style={{ marginTop: 14 }}><label>Nome do orcamento<input value={orcamentoEditando.nome_orcamento} onChange={(event) => setOrcamentoEditando((current) => current ? { ...current, nome_orcamento: event.target.value } : current)} /></label><label>Cliente<select value={orcamentoEditando.cliente_id} onChange={(event) => setOrcamentoEditando((current) => current ? { ...current, cliente_id: event.target.value } : current)}><option value="">Selecione o cliente</option>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}</select></label><div style={{ display: "flex", gap: 10 }}><button type="submit">Salvar</button><button type="button" onClick={() => setOrcamentoEditando(null)}>Cancelar</button></div></form></div>}{orcamentoProdutos && <div className="metric" style={{ marginTop: 18 }}><strong style={{ fontSize: 18 }}>Produtos de {orcamentoProdutos.nome_orcamento}</strong><form onSubmit={handleCadastrarProduto} style={{ marginTop: 14 }}><label>Produto<input value={produtoForm.nome} onChange={(event) => setProdutoForm((current) => ({ ...current, nome: event.target.value }))} /></label><label>Quantidade<input value={produtoForm.quantidade} onChange={(event) => setProdutoForm((current) => ({ ...current, quantidade: event.target.value }))} /></label><label>Valor unitario<input value={produtoForm.valor_unitario} onChange={(event) => setProdutoForm((current) => ({ ...current, valor_unitario: event.target.value }))} /></label><button type="submit">Cadastrar produto</button></form>{mensagemProduto && <p style={{ marginTop: 12 }}>{mensagemProduto}</p>}<div style={{ display: "grid", gap: 8, marginTop: 12 }}>{produtos.map((produto) => <div key={produto.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}><strong>{produto.nome}</strong><p>{produto.quantidade} x {formatarValor(produto.valor_unitario)} = {formatarValor(produto.valor_total)}</p></div>)}</div></div>}<div style={{ marginTop: 24 }}><h2>Lista de orcamentos</h2><form onSubmit={handleBuscarOrcamentos} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}><label>Pesquisar<input value={buscaOrcamento} onChange={(event) => setBuscaOrcamento(event.target.value)} placeholder="Orcamento, cliente ou numero" /></label><button type="submit">Buscar</button></form></div>{mensagemOrcamentos && <p style={{ marginTop: 16 }}>{mensagemOrcamentos}</p>}<div style={{ display: "grid", gap: 10, marginTop: 20 }}>{orcamentos.map((orcamento) => <div className="metric" key={orcamento.id}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}><strong style={{ fontSize: 18 }}>{orcamento.nome_orcamento}</strong><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{opcoesSistema.produtos_orcamento && <button type="button" title="Cadastrar produtos" onClick={() => abrirProdutosOrcamento(orcamento)}>📦</button>}<button type="button" title="Editar orcamento" onClick={() => abrirEditarOrcamento(orcamento)}>✏️</button>{opcoesSistema.aprovacao_pedido && <button type="button" title="Aprovar pedido" onClick={() => handleAprovarOrcamento(orcamento)}>✅</button>}</div></div><p>Cliente: {orcamento.cliente_nome || "Cliente nao informado"}</p><p>Numero do cliente: #{orcamento.numero_pedido}</p><p>Status: {orcamento.status} • Valor: {formatarValor(orcamento.valor_total)}</p></div>)}</div></section>}

        {abaAtiva === "clientes" && <section className="card" style={{ maxWidth: "none" }}><h1>Clientes</h1><p>Cadastre os clientes da loja. CPF/CNPJ, e-mail e celular/WhatsApp sao opcionais.</p><form onSubmit={handleCriarCliente}><label>Nome do cliente<input value={novoCliente.nome} onChange={(event) => setNovoCliente((current) => ({ ...current, nome: event.target.value }))} /></label><label>CPF/CNPJ<input value={novoCliente.documento} onChange={(event) => setNovoCliente((current) => ({ ...current, documento: event.target.value }))} /></label><label>E-mail<input type="email" value={novoCliente.email} onChange={(event) => setNovoCliente((current) => ({ ...current, email: event.target.value }))} /></label><label>Celular/WhatsApp<input value={novoCliente.telefone} onChange={(event) => setNovoCliente((current) => ({ ...current, telefone: event.target.value }))} /></label><button type="submit">Cadastrar cliente</button></form>{mensagemClientes && <p style={{ marginTop: 16 }}>{mensagemClientes}</p>}{clienteEditando && <div className="metric" style={{ marginTop: 24 }}><strong style={{ fontSize: 18 }}>Editar cliente</strong><form onSubmit={handleEditarCliente} style={{ marginTop: 14 }}><label>Nome do cliente<input value={clienteEditando.nome} onChange={(event) => setClienteEditando((current) => current ? { ...current, nome: event.target.value } : current)} /></label><label>CPF/CNPJ<input value={clienteEditando.documento} onChange={(event) => setClienteEditando((current) => current ? { ...current, documento: event.target.value } : current)} /></label><label>E-mail<input type="email" value={clienteEditando.email} onChange={(event) => setClienteEditando((current) => current ? { ...current, email: event.target.value } : current)} /></label><label>Celular/WhatsApp<input value={clienteEditando.telefone} onChange={(event) => setClienteEditando((current) => current ? { ...current, telefone: event.target.value } : current)} /></label><div style={{ display: "flex", gap: 10 }}><button type="submit">Salvar alteracoes</button><button type="button" onClick={() => setClienteEditando(null)}>Cancelar</button></div></form></div>}<div style={{ display: "grid", gap: 10, marginTop: 20 }}>{clientes.map((cliente) => <div className="metric" key={cliente.id}><strong style={{ fontSize: 18 }}>{cliente.nome}</strong><p>CPF/CNPJ: {cliente.documento || "nao informado"}</p><p>E-mail: {cliente.email || "nao informado"}</p><p>WhatsApp: {cliente.telefone || "nao informado"}</p><p>{cliente.ativo === false ? "Inativo" : "Ativo"}</p><button type="button" onClick={() => iniciarEdicaoCliente(cliente)}>Editar</button></div>)}</div></section>}

        {abaAtiva === "usuarios" && <section className="card" style={{ maxWidth: "none" }}><h1>Usuarios</h1><p>Crie usuarios para atendimento, producao, financeiro ou gestao.</p><form onSubmit={handleCriarUsuario}><label>Nome<input value={novoUsuario.nome} onChange={(event) => setNovoUsuario((current) => ({ ...current, nome: event.target.value }))} /></label><label>E-mail<input type="email" value={novoUsuario.email} onChange={(event) => setNovoUsuario((current) => ({ ...current, email: event.target.value }))} /></label><label>Perfil<select value={novoUsuario.perfil} onChange={(event) => setNovoUsuario((current) => ({ ...current, perfil: event.target.value }))}><option value="admin">Admin</option><option value="gerente">Gerente</option><option value="vendedor">Vendedor</option><option value="producao">Producao</option><option value="logistica">Logistica</option><option value="financeiro">Financeiro</option></select></label><button type="submit">Criar usuario</button></form>{mensagem && <p style={{ marginTop: 16 }}>{mensagem}</p>}<div style={{ display: "grid", gap: 10, marginTop: 20 }}>{usuarios.map((usuario) => <div className="metric" key={usuario.id}><strong style={{ fontSize: 18 }}>{usuario.nome}</strong><p>{usuario.email} • {usuario.perfil === "owner" ? "Master" : usuario.perfil}</p></div>)}</div></section>}

        {abaAtiva === "ajustes" && <section className="card" style={{ maxWidth: "none" }}><h1>Ajustes</h1><p>Configure aparencia, logo e modulos. As regras de calculo serao desenvolvidas depois.</p><div className="metric" style={{ marginTop: 18 }}><strong style={{ fontSize: 18 }}>Logo da loja</strong><div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}><div className="logo-preview">{logoMarca ? <img src={logoMarca} alt="Logo da loja" /> : "A"}</div><div style={{ display: "grid", gap: 10 }}><input type="file" accept="image/*" onChange={handleLogoUpload} /><button type="button" onClick={removerLogo}>Remover logo</button></div></div>{mensagemLogo && <p style={{ marginTop: 12 }}>{mensagemLogo}</p>}<p style={{ marginTop: 12 }}>Essa logo substitui o A do menu lateral neste navegador.</p></div><div className="metric" style={{ marginTop: 18 }}><strong style={{ fontSize: 18 }}>Aparencia</strong><div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}><button type="button" onClick={() => alterarTema("dark")} style={botaoAba(tema === "dark")}>Dark mode</button><button type="button" onClick={() => alterarTema("light")} style={botaoAba(tema === "light")}>Light mode</button></div></div><div className="metric" style={{ marginTop: 18 }}><strong style={{ fontSize: 18 }}>Opcoes habilitadas</strong><div style={{ display: "grid", gap: 12, marginTop: 14 }}>{listaOpcoesSistema.map((opcao) => <label key={opcao.chave} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}><input type="checkbox" checked={opcoesSistema[opcao.chave]} onChange={() => alternarOpcao(opcao.chave)} style={{ width: 18, marginTop: 3 }} /><span><strong style={{ fontSize: 16, marginTop: 0 }}>{opcao.titulo}</strong><p>{opcao.descricao}</p></span></label>)}</div></div></section>}

        {abaAtiva === "materiais" && <section className="card" style={{ maxWidth: "none" }}><h1>Cadastro de materiais</h1><p>Categoria ativa: {materialTitulo(categoriaMaterial)}.</p><div className="metric" style={{ marginTop: 18 }}><strong style={{ fontSize: 18 }}>{materialTitulo(categoriaMaterial)}</strong><form><label>Nome do material<input placeholder={`Ex: ${materialTitulo(categoriaMaterial)} principal`} /></label><label>Codigo / referencia<input placeholder="Opcional" /></label><label>Unidade<select><option>Unidade</option><option>Metro linear</option><option>Metro quadrado</option><option>Kit</option><option>Par</option></select></label><label>Custo base<input placeholder="0,00" /></label><button type="button">Salvar material</button></form></div></section>}
      </section>
    </main>
  );
}
