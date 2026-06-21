"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import MateriaisPanel from "./MateriaisPanel";
import ProdutosPanel from "./ProdutosPanel";
import TagsPanel from "./TagsPanel";

type Aba = "painel" | "orcamentos" | "clientes" | "usuarios" | "ajustes" | "produtos" | "materiais" | "tags";
type Permissoes = Record<Aba, boolean>;
type Usuario = { id?: string; nome?: string; email?: string; perfil?: string; permissoes?: Partial<Permissoes> };
type AuthMe = { ok: boolean; usuario: Usuario };
type Cliente = { id: string; nome: string; documento?: string; email?: string; telefone?: string };
type Orcamento = { id: string; nome_orcamento: string; cliente_nome: string; numero_pedido: string; status: string; valor_total: number; cliente_id?: string };

type ClienteForm = { nome: string; documento: string; email: string; telefone: string };
type OrcamentoForm = { nome_orcamento: string; cliente_id: string };

const basePermissoes: Permissoes = {
  painel: true,
  orcamentos: true,
  clientes: true,
  usuarios: false,
  ajustes: false,
  produtos: false,
  materiais: false,
  tags: false,
};

const masterPermissoes: Permissoes = {
  painel: true,
  orcamentos: true,
  clientes: true,
  usuarios: true,
  ajustes: true,
  produtos: true,
  materiais: true,
  tags: true,
};

const titulos: Record<Aba, { titulo: string; subtitulo: string }> = {
  painel: { titulo: "Central operacional", subtitulo: "Visão geral da loja, sessão e módulos ativos." },
  orcamentos: { titulo: "Orçamentos", subtitulo: "Criação, edição, aprovação e acompanhamento de propostas comerciais." },
  clientes: { titulo: "Clientes", subtitulo: "Base comercial conectada aos pedidos e orçamentos." },
  usuarios: { titulo: "Usuários", subtitulo: "Acessos internos, perfis e permissões da empresa." },
  produtos: { titulo: "Produtos configuráveis", subtitulo: "A empresa cria seus próprios produtos e regras de cálculo." },
  materiais: { titulo: "Materiais", subtitulo: "Perfis, sistemas, vidros, puxadores, trilhos, insumos e componentes." },
  tags: { titulo: "Tags inteligentes", subtitulo: "Características e regras de negócio para cálculo automático." },
  ajustes: { titulo: "Ajustes", subtitulo: "Configurações administrativas do ambiente." },
};

const clienteVazio: ClienteForm = { nome: "", documento: "", email: "", telefone: "" };
const orcamentoVazio: OrcamentoForm = { nome_orcamento: "", cliente_id: "" };

function normalizar(permissoes?: Partial<Permissoes>, perfil?: string): Permissoes {
  if (perfil === "owner") return masterPermissoes;
  return { ...basePermissoes, ...(permissoes || {}), usuarios: false };
}

function dinheiro(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
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
  const [mensagem, setMensagem] = useState("");
  const [clienteForm, setClienteForm] = useState<ClienteForm>(clienteVazio);
  const [clienteEditandoId, setClienteEditandoId] = useState("");
  const [orcamentoForm, setOrcamentoForm] = useState<OrcamentoForm>(orcamentoVazio);
  const [orcamentoEditandoId, setOrcamentoEditandoId] = useState("");
  const [novoUsuario, setNovoUsuario] = useState({ nome: "", email: "", perfil: "vendedor", senha: "" });

  const permissoes = normalizar(usuario?.permissoes, usuario?.perfil);
  const isMaster = usuario?.perfil === "owner";
  const pode = (chave: Aba) => Boolean(permissoes[chave]);

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
    setMensagem("");
    if (chave === "clientes") await carregarClientes(empresaSlug);
    if (chave === "orcamentos") { await carregarClientes(empresaSlug); await carregarOrcamentos(empresaSlug); }
    if (chave === "usuarios") await carregarUsuarios(empresaSlug);
  }

  async function sair() {
    try { await apiPost("/api/auth/logout", {}); } catch {}
    window.localStorage.removeItem("anodiza_chave_acesso");
    window.localStorage.removeItem("anodiza_usuario");
    router.push("/login");
  }

  function resetarCliente() {
    setClienteForm(clienteVazio);
    setClienteEditandoId("");
  }

  function editarCliente(cliente: Cliente) {
    setClienteEditandoId(cliente.id);
    setClienteForm({
      nome: cliente.nome || "",
      documento: cliente.documento || "",
      email: cliente.email || "",
      telefone: cliente.telefone || "",
    });
    setMensagem("");
  }

  async function salvarCliente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("");
    try {
      if (clienteEditandoId) {
        await apiPost("/api/loja/clientes/editar", { empresa_slug: empresaSlug, id: clienteEditandoId, ...clienteForm });
      } else {
        await apiPost("/api/loja/clientes", { empresa_slug: empresaSlug, ...clienteForm });
      }
      resetarCliente();
      await carregarClientes(empresaSlug);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao salvar cliente");
    }
  }

  async function apagarCliente(cliente: Cliente) {
    if (!window.confirm(`Apagar ${cliente.nome}? O cliente será removido da lista, mas orçamentos antigos continuam preservados.`)) return;
    setMensagem("");
    try {
      await apiPost("/api/loja/clientes/excluir", { empresa_slug: empresaSlug, id: cliente.id });
      if (clienteEditandoId === cliente.id) resetarCliente();
      await carregarClientes(empresaSlug);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao apagar cliente");
    }
  }

  function resetarOrcamento() {
    setOrcamentoForm(orcamentoVazio);
    setOrcamentoEditandoId("");
  }

  function editarOrcamento(orcamento: Orcamento) {
    setOrcamentoEditandoId(orcamento.id);
    setOrcamentoForm({
      nome_orcamento: orcamento.nome_orcamento || "",
      cliente_id: orcamento.cliente_id || "",
    });
    setMensagem("");
  }

  async function salvarOrcamento(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("");
    try {
      if (orcamentoEditandoId) {
        await apiPost("/api/loja/orcamentos/editar", { empresa_slug: empresaSlug, id: orcamentoEditandoId, ...orcamentoForm });
      } else {
        await apiPost("/api/loja/orcamentos", { empresa_slug: empresaSlug, ...orcamentoForm });
      }
      resetarOrcamento();
      await carregarOrcamentos(empresaSlug);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao salvar orçamento");
    }
  }

  async function aprovarOrcamento(orcamento: Orcamento) {
    if (orcamento.status === "aprovado") return;
    if (!window.confirm(`Aprovar orçamento ${orcamento.nome_orcamento}?`)) return;
    setMensagem("");
    try {
      await apiPost("/api/loja/orcamentos/aprovar", { empresa_slug: empresaSlug, id: orcamento.id });
      await carregarOrcamentos(empresaSlug);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao aprovar orçamento");
    }
  }

  async function criarUsuario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await apiPost("/api/loja/usuarios", { empresa_slug: empresaSlug, ...novoUsuario });
      setNovoUsuario({ nome: "", email: "", perfil: "vendedor", senha: "" });
      await carregarUsuarios(empresaSlug);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao criar usuario");
    }
  }

  async function salvarPermissoes(alvo: Usuario, permissoesNovas: Partial<Permissoes>) {
    try {
      await apiPost("/api/loja/usuarios/permissoes", { empresa_slug: empresaSlug, id: alvo.id, permissoes: permissoesNovas });
      await carregarUsuarios(empresaSlug);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao alterar acessos");
    }
  }

  function itemMenu(chave: Aba, rotulo: string) {
    if (!pode(chave)) return null;
    return <button className={aba === chave ? "nav-active" : ""} onClick={() => abrir(chave)}>{rotulo}</button>;
  }

  if (carregando) return <main className="dashboard"><section className="card"><h1>Carregando sessão...</h1><p>Validando usuário no backend.</p></section></main>;
  if (!usuario) return <main className="dashboard"><section className="card"><h1>Sessão inválida</h1><button onClick={() => router.push("/login")}>Entrar</button></section></main>;

  return (
    <main className="dashboard">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">A</div><div><strong>ANODIZA</strong><p>{usuario.nome}</p></div></div>
        <p>Empresa: {empresaSlug}</p>
        <nav className="app-nav">
          {itemMenu("painel", "Painel")}
          {itemMenu("orcamentos", "Orçamentos")}
          {itemMenu("clientes", "Clientes")}
          {isMaster && <button className={aba === "usuarios" ? "nav-active" : ""} onClick={() => abrir("usuarios")}>Usuários</button>}
          {itemMenu("produtos", "Produtos")}
          {itemMenu("materiais", "Materiais")}
          {itemMenu("tags", "Tags")}
          {itemMenu("ajustes", "Ajustes")}
          <button onClick={sair}>Sair</button>
        </nav>
      </aside>

      <section className="main">
        <header className="dashboard-topbar">
          <div>
            <p className="dashboard-kicker">ANODIZA OS · ambiente autenticado</p>
            <h1>{titulos[aba].titulo}</h1>
            <p>{titulos[aba].subtitulo}</p>
          </div>
          <div className="dashboard-status">Operação online</div>
        </header>

        {mensagem && <p>{mensagem}</p>}

        {aba === "painel" && <section className="card"><h1>Painel da Loja</h1><p>Usuário validado pelo backend. O menu é apenas visual; o bloqueio real está na API.</p><div className="grid"><div className="metric"><p>Clientes carregados</p><strong>{clientes.length}</strong></div><div className="metric"><p>Perfil</p><strong>{usuario.perfil || "-"}</strong></div><div className="metric"><p>Empresa ativa</p><strong>{empresaSlug || "-"}</strong></div></div></section>}

        {aba === "clientes" && (
          <section className="card" style={{ maxWidth: "none" }}>
            <h1>Clientes</h1>
            <form onSubmit={salvarCliente}>
              <label>Nome<input value={clienteForm.nome} onChange={(e) => setClienteForm({ ...clienteForm, nome: e.target.value })} /></label>
              <label>CPF/CNPJ<input value={clienteForm.documento} onChange={(e) => setClienteForm({ ...clienteForm, documento: e.target.value })} /></label>
              <label>E-mail<input value={clienteForm.email} onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })} /></label>
              <label>Celular<input value={clienteForm.telefone} onChange={(e) => setClienteForm({ ...clienteForm, telefone: e.target.value })} /></label>
              <button>{clienteEditandoId ? "Salvar alterações" : "Cadastrar"}</button>
              {clienteEditandoId && <button type="button" onClick={resetarCliente}>Cancelar edição</button>}
            </form>
            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              {clientes.map((c) => (
                <div className="metric" key={c.id}>
                  <strong>{c.nome}</strong>
                  <p>{c.documento || "Sem documento"} • {c.email || "Sem e-mail"} • {c.telefone || "Sem telefone"}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => editarCliente(c)}>Editar</button>
                    <button type="button" onClick={() => apagarCliente(c)}>Apagar</button>
                  </div>
                </div>
              ))}
              {!clientes.length && <p>Nenhum cliente cadastrado.</p>}
            </div>
          </section>
        )}

        {aba === "orcamentos" && (
          <section className="card" style={{ maxWidth: "none" }}>
            <h1>Orçamentos</h1>
            <form onSubmit={salvarOrcamento}>
              <label>Nome<input value={orcamentoForm.nome_orcamento} onChange={(e) => setOrcamentoForm({ ...orcamentoForm, nome_orcamento: e.target.value })} /></label>
              <label>Cliente<select value={orcamentoForm.cliente_id} onChange={(e) => setOrcamentoForm({ ...orcamentoForm, cliente_id: e.target.value })}><option value="">Selecione</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
              <button>{orcamentoEditandoId ? "Salvar alterações" : "Criar"}</button>
              {orcamentoEditandoId && <button type="button" onClick={resetarOrcamento}>Cancelar edição</button>}
            </form>
            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              {orcamentos.map((o) => (
                <div className="metric" key={o.id}>
                  <strong>{o.nome_orcamento}</strong>
                  <p>{o.cliente_nome} • #{o.numero_pedido} • {o.status} • {dinheiro(o.valor_total)}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => editarOrcamento(o)}>Editar nome/cliente</button>
                    <button type="button" onClick={() => aprovarOrcamento(o)} disabled={o.status === "aprovado"}>{o.status === "aprovado" ? "Aprovado" : "Aprovar"}</button>
                  </div>
                </div>
              ))}
              {!orcamentos.length && <p>Nenhum orçamento cadastrado.</p>}
            </div>
          </section>
        )}

        {aba === "usuarios" && isMaster && <section className="card" style={{ maxWidth: "none" }}><h1>Usuários</h1><form onSubmit={criarUsuario}><label>Nome<input value={novoUsuario.nome} onChange={(e) => setNovoUsuario({ ...novoUsuario, nome: e.target.value })} /></label><label>E-mail<input value={novoUsuario.email} onChange={(e) => setNovoUsuario({ ...novoUsuario, email: e.target.value })} /></label><label>Senha inicial<input type="password" value={novoUsuario.senha} onChange={(e) => setNovoUsuario({ ...novoUsuario, senha: e.target.value })} /></label><label>Perfil<select value={novoUsuario.perfil} onChange={(e) => setNovoUsuario({ ...novoUsuario, perfil: e.target.value })}><option value="vendedor">Vendedor</option><option value="financeiro">Financeiro</option><option value="producao">Produção</option><option value="gerente">Gerente</option></select></label><button>Criar</button></form>{usuarios.map((u) => <div className="metric" key={u.id}><strong>{u.nome}</strong><p>{u.email} • {u.perfil}</p>{u.perfil === "owner" ? <p>Master com acesso total.</p> : <button onClick={() => salvarPermissoes(u, normalizar(u.permissoes, u.perfil))}>Salvar acessos atuais</button>}</div>)}</section>}
        {aba === "produtos" && <ProdutosPanel empresaSlug={empresaSlug} />}
        {aba === "materiais" && <MateriaisPanel empresaSlug={empresaSlug} />}
        {aba === "tags" && <TagsPanel empresaSlug={empresaSlug} />}
        {aba === "ajustes" && <section className="card"><h1>Ajustes</h1><p>Configurações gerais da empresa em breve.</p></section>}
      </section>
    </main>
  );
}
