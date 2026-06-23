"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import AjustesPanel from "./AjustesPanel";
import GlobalQuotePanel from "./GlobalQuotePanel";
import MateriaisPanel from "./MateriaisPanel";
import ProdutosPanel from "./ProdutosPanel";
import TagsPanel from "./TagsPanel";

type Aba = "painel" | "orcamentos" | "clientes" | "usuarios" | "ajustes" | "produtos" | "materiais" | "tags";
type MenuGrupoId = "gerencial" | "orcamentos" | "cadastro" | "usuarios" | "calculos" | "ajustes";
type IconName = "home" | "finance" | "cadastro" | "users" | "calc" | "settings";
type Permissoes = Record<Aba, boolean>;
type Usuario = { id?: string; nome?: string; email?: string; perfil?: string; permissoes?: Partial<Permissoes> };
type AuthMe = { ok: boolean; usuario: Usuario };
type Cliente = { id: string; nome: string; documento?: string; email?: string; telefone?: string };
type Orcamento = {
  id: string;
  nome_orcamento: string;
  cliente_nome: string;
  numero_pedido: string;
  status: string;
  valor_total: number;
  preco?: number;
  custo?: number;
  margem?: number;
  margem_percentual?: number;
  cliente_id?: string;
  created_at?: string;
  updated_at?: string;
  aprovado_em?: string;
  usuario_nome?: string;
  aprovado_por?: string;
};

type ClienteForm = { nome: string; documento: string; email: string; telefone: string };
type OrcamentoForm = { nome_orcamento: string; cliente_id: string };
type MenuItem = { aba: Aba; rotulo: string; badge?: string };
type MenuGrupo = { id: MenuGrupoId; rotulo: string; icone: IconName; itens: MenuItem[] };

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
  orcamentos: { titulo: "Orçamentos", subtitulo: "Tabela operacional com cliente, datas, preço, custo, margem, aprovação e usuário." },
  clientes: { titulo: "Clientes", subtitulo: "Base comercial conectada aos pedidos e orçamentos." },
  usuarios: { titulo: "Usuários", subtitulo: "Acessos internos, perfis e permissões da empresa." },
  produtos: { titulo: "Produtos configuráveis", subtitulo: "A empresa cria seus próprios produtos e regras de cálculo." },
  materiais: { titulo: "Materiais", subtitulo: "Perfis, sistemas, vidros, puxadores, trilhos, insumos e componentes." },
  tags: { titulo: "Tags inteligentes", subtitulo: "Características e regras de negócio para cálculo automático." },
  ajustes: { titulo: "Ajustes", subtitulo: "Identidade, aparência, preferências e integrações futuras do ambiente." },
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

function dataCurta(valor?: string) {
  if (!valor) return "-";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

function percentual(valor?: number) {
  return `${Number(valor || 0).toFixed(1).replace(".", ",")}%`;
}

function NavIcon({ name }: { name: IconName | "logout" }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "home") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 11.5 12 5l8 6.5" /><path {...common} d="M6.5 10.5V20h11v-9.5" /><path {...common} d="M10 20v-5h4v5" /></svg>;
  }
  if (name === "finance") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="8" /><path {...common} d="M14.5 9.5c-.55-.42-1.38-.7-2.35-.7-1.32 0-2.35.62-2.35 1.55 0 2.25 4.9.92 4.9 3.35 0 .95-1.02 1.6-2.45 1.6-1.04 0-2.04-.35-2.72-.9" /><path {...common} d="M12 7.6v8.8" /></svg>;
  }
  if (name === "cadastro") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="5" y="5" width="6" height="6" rx="1" /><rect {...common} x="13" y="5" width="6" height="6" rx="1" /><rect {...common} x="5" y="13" width="6" height="6" rx="1" /><path {...common} d="M14 16h4" /><path {...common} d="M16 14v4" /></svg>;
  }
  if (name === "users") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="8" r="3.2" /><path {...common} d="M5.5 19c1.05-3.2 3.08-4.8 6.5-4.8s5.45 1.6 6.5 4.8" /><path {...common} d="M17.5 11.2c1.2.22 2.15.8 2.8 1.75" /><path {...common} d="M6.5 11.2c-1.2.22-2.15.8-2.8 1.75" /></svg>;
  }
  if (name === "calc") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="6" y="4" width="12" height="16" rx="2" /><path {...common} d="M9 8h6" /><path {...common} d="M9 12h.01" /><path {...common} d="M12 12h.01" /><path {...common} d="M15 12h.01" /><path {...common} d="M9 16h.01" /><path {...common} d="M12 16h.01" /><path {...common} d="M15 16h.01" /></svg>;
  }
  if (name === "settings") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M12 3.8v2" /><path {...common} d="M12 18.2v2" /><path {...common} d="M4.9 7.9l1.7 1" /><path {...common} d="M17.4 15.1l1.7 1" /><path {...common} d="M19.1 7.9l-1.7 1" /><path {...common} d="M6.6 15.1l-1.7 1" /><path {...common} d="M3.8 12h2" /><path {...common} d="M18.2 12h2" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M10 6H6.5A2.5 2.5 0 0 0 4 8.5v7A2.5 2.5 0 0 0 6.5 18H10" /><path {...common} d="M14 8l4 4-4 4" /><path {...common} d="M18 12H9" /></svg>;
}

export default function LojaPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [empresaSlug, setEmpresaSlug] = useState("");
  const [aba, setAba] = useState<Aba>("painel");
  const [menuAberto, setMenuAberto] = useState<MenuGrupoId | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [orcamentoProduto, setOrcamentoProduto] = useState<Orcamento | null>(null);
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
      if (!chave) {
        router.push("/login");
        return;
      }

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
    setOrcamentoProduto(null);
    if (chave === "clientes") await carregarClientes(empresaSlug);
    if (chave === "orcamentos") {
      await carregarClientes(empresaSlug);
      await carregarOrcamentos(empresaSlug);
    }
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

  const gruposMenu: MenuGrupo[] = [
    { id: "gerencial", rotulo: "Gerencial", icone: "home", itens: [{ aba: "painel", rotulo: "Painel" }] },
    { id: "orcamentos", rotulo: "Orçamentos", icone: "finance", itens: [{ aba: "orcamentos", rotulo: "Orçamentos" }, { aba: "clientes", rotulo: "Clientes" }] },
    { id: "cadastro", rotulo: "Cadastro", icone: "cadastro", itens: [{ aba: "materiais", rotulo: "Materiais" }] },
    { id: "usuarios", rotulo: "Usuários", icone: "users", itens: [{ aba: "usuarios", rotulo: "Usuários" }] },
    { id: "calculos", rotulo: "Cálculos", icone: "calc", itens: [{ aba: "produtos", rotulo: "Produtos" }, { aba: "tags", rotulo: "Tags" }] },
    { id: "ajustes", rotulo: "Ajustes", icone: "settings", itens: [{ aba: "ajustes", rotulo: "Ajustes" }] },
  ];

  const gruposVisiveis = gruposMenu
    .map((grupo) => ({ ...grupo, itens: grupo.itens.filter((item) => pode(item.aba)) }))
    .filter((grupo) => grupo.itens.length > 0);
  const grupoSecundario = gruposVisiveis.find((grupo) => grupo.id === menuAberto) || null;

  function grupoAtivo(grupo: MenuGrupo) {
    return grupo.itens.some((item) => item.aba === aba);
  }

  function abrirGrupo(grupo: MenuGrupo) {
    setMenuAberto(grupo.id);
    if (grupo.itens.length === 1) {
      void abrir(grupo.itens[0].aba);
    }
  }

  if (carregando) return <main className="dashboard"><section className="card"><h1>Carregando sessão...</h1><p>Validando usuário....</p></section></main>;
  if (!usuario) return <main className="dashboard"><section className="card"><h1>Sessão inválida</h1><button onClick={() => router.push("/login")}>Entrar</button></section></main>;

  return (
    <main className={`dashboard ${grupoSecundario ? "menu-secondary-open" : ""}`}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">A</div><div><strong>ANODIZA</strong><p>{usuario.nome}</p></div></div>
        <p className="sidebar-company">Empresa: {empresaSlug}</p>
        <nav className="app-nav" aria-label="Menu principal">
          {gruposVisiveis.map((grupo) => (
            <button
              key={grupo.id}
              type="button"
              className={`nav-primary-button ${grupoAtivo(grupo) ? "nav-active" : ""} ${grupoSecundario?.id === grupo.id ? "nav-open" : ""}`}
              aria-haspopup="menu"
              aria-expanded={grupoSecundario?.id === grupo.id}
              onClick={() => abrirGrupo(grupo)}
            >
              <span className="nav-icon"><NavIcon name={grupo.icone} /></span>
              <span className="nav-label">{grupo.rotulo}</span>
              <span className="nav-chevron">›</span>
            </button>
          ))}
          <button type="button" className="nav-primary-button nav-logout" onClick={sair}>
            <span className="nav-icon"><NavIcon name="logout" /></span>
            <span className="nav-label">Sair</span>
          </button>
        </nav>
      </aside>

      {grupoSecundario && (
        <aside className="nav-secondary-panel" aria-label={`Submenu ${grupoSecundario.rotulo}`}>
          <div className="nav-secondary-header">
            <span>{grupoSecundario.rotulo}</span>
            <button type="button" aria-label="Fechar submenu" onClick={() => setMenuAberto(null)}>×</button>
          </div>
          <nav className="nav-secondary-list" role="menu">
            {grupoSecundario.itens.map((item) => (
              <button
                key={item.aba}
                type="button"
                role="menuitem"
                className={aba === item.aba ? "nav-active" : ""}
                onClick={() => abrir(item.aba)}
              >
                <span>{item.rotulo}</span>
                {item.badge && <small>{item.badge}</small>}
              </button>
            ))}
          </nav>
        </aside>
      )}

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

        {aba === "painel" && (
          <section className="card">
            <h1>Painel da Loja</h1>
            <p>Usuário validado pelo backend. O menu é apenas visual; o bloqueio real está na API.</p>
            <div className="grid">
              <div className="metric"><p>Clientes carregados</p><strong>{clientes.length}</strong></div>
              <div className="metric"><p>Perfil</p><strong>{usuario.perfil || "-"}</strong></div>
              <div className="metric"><p>Empresa ativa</p><strong>{empresaSlug || "-"}</strong></div>
            </div>
          </section>
        )}

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
            {orcamentoProduto && <GlobalQuotePanel empresaSlug={empresaSlug} orcamento={orcamentoProduto} onClose={() => setOrcamentoProduto(null)} onSaved={() => carregarOrcamentos(empresaSlug)} />}
            <div style={{ overflowX: "auto", marginTop: 18 }}>
              <table style={{ width: "100%", minWidth: 1280, borderCollapse: "collapse" }}>
                <thead><tr><th style={{ textAlign: "left", padding: 10 }}>#</th><th style={{ textAlign: "left", padding: 10 }}>Orçamento</th><th style={{ textAlign: "left", padding: 10 }}>Cliente</th><th style={{ textAlign: "left", padding: 10 }}>Criação</th><th style={{ textAlign: "left", padding: 10 }}>Aprovação</th><th style={{ textAlign: "right", padding: 10 }}>Custo</th><th style={{ textAlign: "right", padding: 10 }}>Margem</th><th style={{ textAlign: "right", padding: 10 }}>Preço</th><th style={{ textAlign: "left", padding: 10 }}>Status</th><th style={{ textAlign: "left", padding: 10 }}>Criado por</th><th style={{ textAlign: "left", padding: 10 }}>Ações</th></tr></thead>
                <tbody>{orcamentos.map((o) => <tr key={o.id} style={{ borderTop: "1px solid var(--border)" }}><td style={{ padding: 10 }}>{o.numero_pedido || "-"}</td><td style={{ padding: 10 }}><strong>{o.nome_orcamento}</strong></td><td style={{ padding: 10 }}>{o.cliente_nome || "-"}</td><td style={{ padding: 10 }}>{dataCurta(o.created_at)}</td><td style={{ padding: 10 }}>{dataCurta(o.aprovado_em)}</td><td style={{ padding: 10, textAlign: "right" }}>{dinheiro(o.custo || 0)}</td><td style={{ padding: 10, textAlign: "right" }}>{dinheiro(o.margem || 0)} <small>({percentual(o.margem_percentual)})</small></td><td style={{ padding: 10, textAlign: "right" }}>{dinheiro(o.preco ?? o.valor_total)}</td><td style={{ padding: 10 }}>{o.status || "rascunho"}</td><td style={{ padding: 10 }}>{o.usuario_nome || "-"}</td><td style={{ padding: 10 }}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" onClick={() => setOrcamentoProduto(o)}>Orçamento</button><button type="button" onClick={() => editarOrcamento(o)}>Editar</button><button type="button" onClick={() => aprovarOrcamento(o)} disabled={o.status === "aprovado"}>{o.status === "aprovado" ? "Aprovado" : "Aprovar"}</button></div></td></tr>)}</tbody>
              </table>
              {!orcamentos.length && <p style={{ marginTop: 12 }}>Nenhum orçamento cadastrado.</p>}
            </div>
          </section>
        )}

        {aba === "usuarios" && isMaster && (
          <section className="card" style={{ maxWidth: "none" }}>
            <h1>Usuários</h1>
            <form onSubmit={criarUsuario}>
              <label>Nome<input value={novoUsuario.nome} onChange={(e) => setNovoUsuario({ ...novoUsuario, nome: e.target.value })} /></label>
              <label>E-mail<input value={novoUsuario.email} onChange={(e) => setNovoUsuario({ ...novoUsuario, email: e.target.value })} /></label>
              <label>Senha inicial<input type="password" value={novoUsuario.senha} onChange={(e) => setNovoUsuario({ ...novoUsuario, senha: e.target.value })} /></label>
              <label>Perfil<select value={novoUsuario.perfil} onChange={(e) => setNovoUsuario({ ...novoUsuario, perfil: e.target.value })}><option value="vendedor">Vendedor</option><option value="financeiro">Financeiro</option><option value="producao">Produção</option><option value="gerente">Gerente</option></select></label>
              <button>Criar</button>
            </form>
            {usuarios.map((u) => <div className="metric" key={u.id}><strong>{u.nome}</strong><p>{u.email} • {u.perfil}</p>{u.perfil === "owner" ? <p>Master com acesso total.</p> : <button onClick={() => salvarPermissoes(u, normalizar(u.permissoes, u.perfil))}>Salvar acessos atuais</button>}</div>)}
          </section>
        )}
        {aba === "produtos" && <ProdutosPanel empresaSlug={empresaSlug} />}
        {aba === "materiais" && <MateriaisPanel empresaSlug={empresaSlug} />}
        {aba === "tags" && <TagsPanel empresaSlug={empresaSlug} />}
        {aba === "ajustes" && <AjustesPanel empresaSlug={empresaSlug} />}
      </section>
    </main>
  );
}
