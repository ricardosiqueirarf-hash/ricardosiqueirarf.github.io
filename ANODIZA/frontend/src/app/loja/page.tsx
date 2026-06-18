"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type Usuario = { id: string; nome: string; email: string; perfil: string; ativo?: boolean };
type Cliente = { id: string; nome: string; telefone?: string; ativo?: boolean };
type Orcamento = {
  id: string;
  cliente_id?: string;
  cliente_nome: string;
  numero_pedido: string;
  nome_orcamento: string;
  status: string;
  valor_total: number;
  created_at?: string;
};
type LojaIndex = { titulo: string; cards: { label: string; valor: number }[] };
type Aba = "painel" | "orcamentos" | "usuarios";

const fallbackIndex: LojaIndex = {
  titulo: "Painel da Loja",
  cards: [
    { label: "Orcamentos", valor: 0 },
    { label: "Aprovados", valor: 0 },
    { label: "Em producao", valor: 0 },
  ],
};

function formatarValor(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
}

export default function LojaPage() {
  const [abaAtiva, setAbaAtiva] = useState<Aba>("painel");
  const [data, setData] = useState<LojaIndex>(fallbackIndex);
  const [empresaSlug, setEmpresaSlug] = useState("");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [buscaOrcamento, setBuscaOrcamento] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [mensagemOrcamentos, setMensagemOrcamentos] = useState("");
  const [mensagemNovoOrcamento, setMensagemNovoOrcamento] = useState("");
  const [novoUsuario, setNovoUsuario] = useState({ nome: "", email: "", perfil: "vendedor" });
  const [novoOrcamento, setNovoOrcamento] = useState({ nome_orcamento: "", cliente_nome: "" });

  async function carregarClientes(slug: string) {
    if (!slug) return;
    try {
      const lista = await apiGet<Cliente[]>(`/api/loja/clientes?empresa_slug=${encodeURIComponent(slug)}`);
      setClientes(lista);
    } catch {
      setClientes([]);
    }
  }

  async function carregarUsuarios(slug: string) {
    if (!slug) return;
    try {
      const lista = await apiGet<Usuario[]>(`/api/loja/usuarios?empresa_slug=${encodeURIComponent(slug)}`);
      setUsuarios(lista);
    } catch {
      setUsuarios([]);
    }
  }

  async function carregarOrcamentos(slug: string, busca = buscaOrcamento) {
    if (!slug) return;
    setMensagemOrcamentos("Carregando orcamentos...");
    try {
      const params = new URLSearchParams({ empresa_slug: slug, busca });
      const lista = await apiGet<Orcamento[]>(`/api/loja/orcamentos?${params.toString()}`);
      setOrcamentos(lista);
      setMensagemOrcamentos(lista.length ? "" : "Nenhum orcamento encontrado.");
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : "Erro desconhecido";
      setOrcamentos([]);
      setMensagemOrcamentos(`Nao foi possivel carregar os orcamentos. ${detalhe}`);
    }
  }

  useEffect(() => {
    const slug = localStorage.getItem("anodiza_empresa_slug") || "";
    setEmpresaSlug(slug);
    apiGet<LojaIndex>("/api/loja/index").then(setData).catch(() => setData(fallbackIndex));
    carregarClientes(slug);
    carregarUsuarios(slug);
  }, []);

  async function abrirAbaUsuarios() {
    setAbaAtiva("usuarios");
    await carregarUsuarios(empresaSlug);
  }

  async function abrirAbaOrcamentos() {
    setAbaAtiva("orcamentos");
    await carregarClientes(empresaSlug);
    await carregarOrcamentos(empresaSlug);
  }

  async function handleBuscarOrcamentos(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await carregarOrcamentos(empresaSlug, buscaOrcamento);
  }

  async function handleCriarOrcamento(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!empresaSlug) {
      setMensagemNovoOrcamento("Entre novamente para identificar a empresa.");
      return;
    }
    if (!novoOrcamento.nome_orcamento.trim()) {
      setMensagemNovoOrcamento("Informe o nome do orcamento.");
      return;
    }
    if (!novoOrcamento.cliente_nome.trim()) {
      setMensagemNovoOrcamento("Informe o nome do cliente.");
      return;
    }

    setMensagemNovoOrcamento("Criando orcamento...");
    try {
      await apiPost("/api/loja/orcamentos", { empresa_slug: empresaSlug, ...novoOrcamento });
      setNovoOrcamento({ nome_orcamento: "", cliente_nome: novoOrcamento.cliente_nome });
      setMensagemNovoOrcamento("Orcamento criado com numeracao automatica do cliente.");
      await carregarClientes(empresaSlug);
      await carregarOrcamentos(empresaSlug, buscaOrcamento);
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : "Erro desconhecido";
      setMensagemNovoOrcamento(`Nao foi possivel criar o orcamento. ${detalhe}`);
    }
  }

  async function handleCriarUsuario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!empresaSlug) {
      setMensagem("Entre novamente para identificar a empresa.");
      return;
    }
    setMensagem("Criando usuario...");
    try {
      await apiPost("/api/loja/usuarios", { empresa_slug: empresaSlug, ...novoUsuario });
      setNovoUsuario({ nome: "", email: "", perfil: "vendedor" });
      setMensagem("Usuario criado.");
      await carregarUsuarios(empresaSlug);
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : "Erro desconhecido";
      setMensagem(`Nao foi possivel criar o usuario. ${detalhe}`);
    }
  }

  return (
    <main className="dashboard">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">A</div><div><strong>ANODIZA</strong><p>Loja</p></div></div>
        <p>Empresa ativa: {empresaSlug || "nao identificada"}</p>

        <nav style={{ display: "grid", gap: 10, marginTop: 28 }}>
          <button
            type="button"
            onClick={() => setAbaAtiva("painel")}
            style={{ background: abaAtiva === "painel" ? "var(--primary)" : "#0f172a", color: abaAtiva === "painel" ? "#111827" : "var(--text)", border: "1px solid var(--border)" }}
          >
            Painel
          </button>
          <button
            type="button"
            onClick={abrirAbaOrcamentos}
            style={{ background: abaAtiva === "orcamentos" ? "var(--primary)" : "#0f172a", color: abaAtiva === "orcamentos" ? "#111827" : "var(--text)", border: "1px solid var(--border)" }}
          >
            Orcamentos
          </button>
          <button
            type="button"
            onClick={abrirAbaUsuarios}
            style={{ background: abaAtiva === "usuarios" ? "var(--primary)" : "#0f172a", color: abaAtiva === "usuarios" ? "#111827" : "var(--text)", border: "1px solid var(--border)" }}
          >
            Usuarios
          </button>
        </nav>
      </aside>

      <section className="main">
        {abaAtiva === "painel" && (
          <>
            <h1>{data.titulo}</h1>
            <p>Visao geral da loja ativa.</p>
            <div className="grid">
              {data.cards.map((card) => (
                <div className="metric" key={card.label}>
                  <p>{card.label}</p>
                  <strong>{card.valor}</strong>
                </div>
              ))}
            </div>
          </>
        )}

        {abaAtiva === "orcamentos" && (
          <section className="card" style={{ maxWidth: "none" }}>
            <h1>Orcamentos</h1>
            <p>Agora o orcamento tem nome proprio e pertence a um cliente. A numeracao e automatica por cliente: Cliente A 1, 2, 3; Cliente B 1, 2, 3.</p>

            <div className="metric" style={{ marginTop: 18 }}>
              <strong style={{ fontSize: 18 }}>Criar orcamento</strong>
              <form onSubmit={handleCriarOrcamento} style={{ marginTop: 14 }}>
                <label>Nome do orcamento
                  <input value={novoOrcamento.nome_orcamento} onChange={(event) => setNovoOrcamento((current) => ({ ...current, nome_orcamento: event.target.value }))} />
                </label>
                <label>Nome do cliente
                  <input list="clientes-cadastrados" value={novoOrcamento.cliente_nome} onChange={(event) => setNovoOrcamento((current) => ({ ...current, cliente_nome: event.target.value }))} />
                  <datalist id="clientes-cadastrados">
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.nome} />
                    ))}
                  </datalist>
                </label>
                <button type="submit">Criar orcamento</button>
              </form>
              {mensagemNovoOrcamento && <p style={{ marginTop: 12 }}>{mensagemNovoOrcamento}</p>}
            </div>

            <div style={{ marginTop: 24 }}>
              <h2>Lista de orcamentos</h2>
              <form onSubmit={handleBuscarOrcamentos} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
                <label>Pesquisar
                  <input
                    value={buscaOrcamento}
                    onChange={(event) => setBuscaOrcamento(event.target.value)}
                    placeholder="Orcamento, cliente ou numero"
                  />
                </label>
                <button type="submit">Buscar</button>
              </form>
            </div>

            {mensagemOrcamentos && <p style={{ marginTop: 16 }}>{mensagemOrcamentos}</p>}
            <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
              {orcamentos.map((orcamento) => (
                <div className="metric" key={orcamento.id}>
                  <strong style={{ fontSize: 18 }}>{orcamento.nome_orcamento}</strong>
                  <p>Cliente: {orcamento.cliente_nome || "Cliente nao informado"}</p>
                  <p>Numero do cliente: #{orcamento.numero_pedido}</p>
                  <p>Status: {orcamento.status} • Valor: {formatarValor(orcamento.valor_total)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {abaAtiva === "usuarios" && (
          <section className="card" style={{ maxWidth: "none" }}>
            <h1>Usuarios</h1>
            <p>Crie usuarios para atendimento, producao, financeiro ou gestao.</p>
            <form onSubmit={handleCriarUsuario}>
              <label>Nome<input value={novoUsuario.nome} onChange={(event) => setNovoUsuario((current) => ({ ...current, nome: event.target.value }))} /></label>
              <label>E-mail<input type="email" value={novoUsuario.email} onChange={(event) => setNovoUsuario((current) => ({ ...current, email: event.target.value }))} /></label>
              <label>Perfil
                <select value={novoUsuario.perfil} onChange={(event) => setNovoUsuario((current) => ({ ...current, perfil: event.target.value }))} style={{ borderRadius: 14, padding: 14, background: "#0f172a", color: "white", border: "1px solid var(--border)" }}>
                  <option value="admin">Admin</option>
                  <option value="gerente">Gerente</option>
                  <option value="vendedor">Vendedor</option>
                  <option value="producao">Producao</option>
                  <option value="logistica">Logistica</option>
                  <option value="financeiro">Financeiro</option>
                </select>
              </label>
              <button type="submit">Criar usuario</button>
            </form>
            {mensagem && <p style={{ marginTop: 16 }}>{mensagem}</p>}
            <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
              {usuarios.map((usuario) => (
                <div className="metric" key={usuario.id}>
                  <strong style={{ fontSize: 18 }}>{usuario.nome}</strong>
                  <p>{usuario.email} • {usuario.perfil === "owner" ? "Master" : usuario.perfil}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
