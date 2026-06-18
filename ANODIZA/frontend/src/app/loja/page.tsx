"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type Usuario = { id: string; nome: string; email: string; perfil: string; ativo?: boolean };
type Cliente = { id: string; nome: string; documento?: string; email?: string; telefone?: string; ativo?: boolean };
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
type ProdutoOrcamento = { id: string; nome: string; quantidade: number; valor_unitario: number; valor_total: number };
type LojaIndex = { titulo: string; cards: { label: string; valor: number }[] };
type Aba = "painel" | "orcamentos" | "clientes" | "usuarios";
type ClienteForm = { id?: string; nome: string; documento: string; email: string; telefone: string };

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

function formatarValor(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
}

function botaoAba(ativa: boolean) {
  return { background: ativa ? "var(--primary)" : "#0f172a", color: ativa ? "#111827" : "var(--text)", border: "1px solid var(--border)" };
}

export default function LojaPage() {
  const [abaAtiva, setAbaAtiva] = useState<Aba>("painel");
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

  async function carregarProdutos(orcamentoId: string) {
    if (!empresaSlug || !orcamentoId) return;
    setMensagemProduto("Carregando produtos...");
    try {
      const params = new URLSearchParams({ empresa_slug: empresaSlug, orcamento_id: orcamentoId });
      const lista = await apiGet<ProdutoOrcamento[]>(`/api/loja/orcamentos/produtos?${params.toString()}`);
      setProdutos(lista);
      setMensagemProduto(lista.length ? "" : "Nenhum produto cadastrado neste orcamento.");
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : "Erro desconhecido";
      setProdutos([]);
      setMensagemProduto(`Nao foi possivel carregar produtos. ${detalhe}`);
    }
  }

  useEffect(() => {
    const slug = localStorage.getItem("anodiza_empresa_slug") || "";
    setEmpresaSlug(slug);
    apiGet<LojaIndex>("/api/loja/index").then(setData).catch(() => setData(fallbackIndex));
    carregarClientes(slug);
    carregarUsuarios(slug);
  }, []);

  async function abrirAbaClientes() {
    setAbaAtiva("clientes");
    await carregarClientes(empresaSlug);
  }

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

  async function handleCriarCliente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!empresaSlug) {
      setMensagemClientes("Entre novamente para identificar a empresa.");
      return;
    }
    if (!novoCliente.nome.trim()) {
      setMensagemClientes("Informe o nome do cliente.");
      return;
    }

    setMensagemClientes("Cadastrando cliente...");
    try {
      await apiPost("/api/loja/clientes", { empresa_slug: empresaSlug, ...novoCliente });
      setNovoCliente(clienteVazio);
      setMensagemClientes("Cliente cadastrado.");
      await carregarClientes(empresaSlug);
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : "Erro desconhecido";
      setMensagemClientes(`Nao foi possivel cadastrar o cliente. ${detalhe}`);
    }
  }

  async function handleEditarCliente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clienteEditando) return;
    if (!clienteEditando.nome.trim()) {
      setMensagemClientes("Informe o nome do cliente.");
      return;
    }

    setMensagemClientes("Salvando cliente...");
    try {
      await apiPost("/api/loja/clientes/editar", { empresa_slug: empresaSlug, ...clienteEditando });
      setClienteEditando(null);
      setMensagemClientes("Cliente atualizado.");
      await carregarClientes(empresaSlug);
      await carregarOrcamentos(empresaSlug, buscaOrcamento);
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : "Erro desconhecido";
      setMensagemClientes(`Nao foi possivel editar o cliente. ${detalhe}`);
    }
  }

  function iniciarEdicaoCliente(cliente: Cliente) {
    setClienteEditando({
      id: cliente.id,
      nome: cliente.nome || "",
      documento: cliente.documento || "",
      email: cliente.email || "",
      telefone: cliente.telefone || "",
    });
    setMensagemClientes("");
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
    if (!novoOrcamento.cliente_id) {
      setMensagemNovoOrcamento("Selecione o cliente.");
      return;
    }

    setMensagemNovoOrcamento("Criando orcamento...");
    try {
      await apiPost("/api/loja/orcamentos", { empresa_slug: empresaSlug, ...novoOrcamento });
      setNovoOrcamento((current) => ({ nome_orcamento: "", cliente_id: current.cliente_id }));
      setMensagemNovoOrcamento("Orcamento criado com numeracao automatica do cliente.");
      await carregarOrcamentos(empresaSlug, buscaOrcamento);
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : "Erro desconhecido";
      setMensagemNovoOrcamento(`Nao foi possivel criar o orcamento. ${detalhe}`);
    }
  }

  function abrirEditarOrcamento(orcamento: Orcamento) {
    setOrcamentoEditando({ id: orcamento.id, nome_orcamento: orcamento.nome_orcamento, cliente_id: orcamento.cliente_id || "" });
    setOrcamentoProdutos(null);
  }

  async function handleEditarOrcamento(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orcamentoEditando) return;
    setMensagemOrcamentos("Salvando orcamento...");
    try {
      await apiPost("/api/loja/orcamentos/editar", { empresa_slug: empresaSlug, ...orcamentoEditando });
      setOrcamentoEditando(null);
      setMensagemOrcamentos("Orcamento atualizado.");
      await carregarOrcamentos(empresaSlug, buscaOrcamento);
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : "Erro desconhecido";
      setMensagemOrcamentos(`Nao foi possivel editar o orcamento. ${detalhe}`);
    }
  }

  async function handleAprovarOrcamento(orcamento: Orcamento) {
    if (typeof window !== "undefined" && !window.confirm(`Aprovar o pedido ${orcamento.nome_orcamento}?`)) return;
    setMensagemOrcamentos("Aprovando pedido...");
    try {
      await apiPost("/api/loja/orcamentos/aprovar", { empresa_slug: empresaSlug, id: orcamento.id });
      setMensagemOrcamentos("Pedido aprovado.");
      await carregarOrcamentos(empresaSlug, buscaOrcamento);
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : "Erro desconhecido";
      setMensagemOrcamentos(`Nao foi possivel aprovar o pedido. ${detalhe}`);
    }
  }

  async function abrirProdutosOrcamento(orcamento: Orcamento) {
    setOrcamentoProdutos(orcamento);
    setOrcamentoEditando(null);
    setProdutoForm(produtoVazio);
    await carregarProdutos(orcamento.id);
  }

  async function handleCadastrarProduto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orcamentoProdutos) return;
    if (!produtoForm.nome.trim()) {
      setMensagemProduto("Informe o nome do produto.");
      return;
    }
    setMensagemProduto("Cadastrando produto...");
    try {
      await apiPost("/api/loja/orcamentos/produtos", { empresa_slug: empresaSlug, orcamento_id: orcamentoProdutos.id, ...produtoForm });
      setProdutoForm(produtoVazio);
      setMensagemProduto("Produto cadastrado.");
      await carregarProdutos(orcamentoProdutos.id);
      await carregarOrcamentos(empresaSlug, buscaOrcamento);
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : "Erro desconhecido";
      setMensagemProduto(`Nao foi possivel cadastrar o produto. ${detalhe}`);
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
          <button type="button" onClick={() => setAbaAtiva("painel")} style={botaoAba(abaAtiva === "painel")}>Painel</button>
          <button type="button" onClick={abrirAbaOrcamentos} style={botaoAba(abaAtiva === "orcamentos")}>Orcamentos</button>
          <button type="button" onClick={abrirAbaClientes} style={botaoAba(abaAtiva === "clientes")}>Clientes</button>
          <button type="button" onClick={abrirAbaUsuarios} style={botaoAba(abaAtiva === "usuarios")}>Usuarios</button>
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
            <p>Use os icones da lista para produtos, edicao e aprovacao do pedido.</p>

            <div className="metric" style={{ marginTop: 18 }}>
              <strong style={{ fontSize: 18 }}>Criar orcamento</strong>
              <form onSubmit={handleCriarOrcamento} style={{ marginTop: 14 }}>
                <label>Nome do orcamento
                  <input value={novoOrcamento.nome_orcamento} onChange={(event) => setNovoOrcamento((current) => ({ ...current, nome_orcamento: event.target.value }))} />
                </label>
                <label>Cliente
                  <select
                    value={novoOrcamento.cliente_id}
                    onChange={(event) => setNovoOrcamento((current) => ({ ...current, cliente_id: event.target.value }))}
                    style={{ borderRadius: 14, padding: 14, background: "#0f172a", color: "white", border: "1px solid var(--border)" }}
                  >
                    <option value="">Selecione o cliente</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
                    ))}
                  </select>
                </label>
                <button type="submit">Criar orcamento</button>
              </form>
              {mensagemNovoOrcamento && <p style={{ marginTop: 12 }}>{mensagemNovoOrcamento}</p>}
              {!clientes.length && <p style={{ marginTop: 12 }}>Cadastre um cliente antes de criar orcamentos.</p>}
            </div>

            {orcamentoEditando && (
              <div className="metric" style={{ marginTop: 18 }}>
                <strong style={{ fontSize: 18 }}>Editar orcamento</strong>
                <form onSubmit={handleEditarOrcamento} style={{ marginTop: 14 }}>
                  <label>Nome do orcamento
                    <input value={orcamentoEditando.nome_orcamento} onChange={(event) => setOrcamentoEditando((current) => current ? { ...current, nome_orcamento: event.target.value } : current)} />
                  </label>
                  <label>Cliente
                    <select
                      value={orcamentoEditando.cliente_id}
                      onChange={(event) => setOrcamentoEditando((current) => current ? { ...current, cliente_id: event.target.value } : current)}
                      style={{ borderRadius: 14, padding: 14, background: "#0f172a", color: "white", border: "1px solid var(--border)" }}
                    >
                      <option value="">Selecione o cliente</option>
                      {clientes.map((cliente) => (
                        <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
                      ))}
                    </select>
                  </label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="submit">Salvar</button>
                    <button type="button" onClick={() => setOrcamentoEditando(null)}>Cancelar</button>
                  </div>
                </form>
              </div>
            )}

            {orcamentoProdutos && (
              <div className="metric" style={{ marginTop: 18 }}>
                <strong style={{ fontSize: 18 }}>Produtos de {orcamentoProdutos.nome_orcamento}</strong>
                <form onSubmit={handleCadastrarProduto} style={{ marginTop: 14 }}>
                  <label>Produto
                    <input value={produtoForm.nome} onChange={(event) => setProdutoForm((current) => ({ ...current, nome: event.target.value }))} />
                  </label>
                  <label>Quantidade
                    <input value={produtoForm.quantidade} onChange={(event) => setProdutoForm((current) => ({ ...current, quantidade: event.target.value }))} />
                  </label>
                  <label>Valor unitario
                    <input value={produtoForm.valor_unitario} onChange={(event) => setProdutoForm((current) => ({ ...current, valor_unitario: event.target.value }))} />
                  </label>
                  <button type="submit">Cadastrar produto</button>
                </form>
                {mensagemProduto && <p style={{ marginTop: 12 }}>{mensagemProduto}</p>}
                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                  {produtos.map((produto) => (
                    <div key={produto.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                      <strong>{produto.nome}</strong>
                      <p>{produto.quantidade} x {formatarValor(produto.valor_unitario)} = {formatarValor(produto.valor_total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <strong style={{ fontSize: 18 }}>{orcamento.nome_orcamento}</strong>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" title="Cadastrar produtos" onClick={() => abrirProdutosOrcamento(orcamento)}>📦</button>
                      <button type="button" title="Editar orcamento" onClick={() => abrirEditarOrcamento(orcamento)}>✏️</button>
                      <button type="button" title="Aprovar pedido" onClick={() => handleAprovarOrcamento(orcamento)}>✅</button>
                    </div>
                  </div>
                  <p>Cliente: {orcamento.cliente_nome || "Cliente nao informado"}</p>
                  <p>Numero do cliente: #{orcamento.numero_pedido}</p>
                  <p>Status: {orcamento.status} • Valor: {formatarValor(orcamento.valor_total)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {abaAtiva === "clientes" && (
          <section className="card" style={{ maxWidth: "none" }}>
            <h1>Clientes</h1>
            <p>Cadastre os clientes da loja. CPF/CNPJ, e-mail e celular/WhatsApp sao opcionais.</p>
            <form onSubmit={handleCriarCliente}>
              <label>Nome do cliente
                <input value={novoCliente.nome} onChange={(event) => setNovoCliente((current) => ({ ...current, nome: event.target.value }))} />
              </label>
              <label>CPF/CNPJ
                <input value={novoCliente.documento} onChange={(event) => setNovoCliente((current) => ({ ...current, documento: event.target.value }))} />
              </label>
              <label>E-mail
                <input type="email" value={novoCliente.email} onChange={(event) => setNovoCliente((current) => ({ ...current, email: event.target.value }))} />
              </label>
              <label>Celular/WhatsApp
                <input value={novoCliente.telefone} onChange={(event) => setNovoCliente((current) => ({ ...current, telefone: event.target.value }))} />
              </label>
              <button type="submit">Cadastrar cliente</button>
            </form>
            {mensagemClientes && <p style={{ marginTop: 16 }}>{mensagemClientes}</p>}

            {clienteEditando && (
              <div className="metric" style={{ marginTop: 24 }}>
                <strong style={{ fontSize: 18 }}>Editar cliente</strong>
                <form onSubmit={handleEditarCliente} style={{ marginTop: 14 }}>
                  <label>Nome do cliente
                    <input value={clienteEditando.nome} onChange={(event) => setClienteEditando((current) => current ? { ...current, nome: event.target.value } : current)} />
                  </label>
                  <label>CPF/CNPJ
                    <input value={clienteEditando.documento} onChange={(event) => setClienteEditando((current) => current ? { ...current, documento: event.target.value } : current)} />
                  </label>
                  <label>E-mail
                    <input type="email" value={clienteEditando.email} onChange={(event) => setClienteEditando((current) => current ? { ...current, email: event.target.value } : current)} />
                  </label>
                  <label>Celular/WhatsApp
                    <input value={clienteEditando.telefone} onChange={(event) => setClienteEditando((current) => current ? { ...current, telefone: event.target.value } : current)} />
                  </label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="submit">Salvar alteracoes</button>
                    <button type="button" onClick={() => setClienteEditando(null)}>Cancelar</button>
                  </div>
                </form>
              </div>
            )}

            <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
              {clientes.map((cliente) => (
                <div className="metric" key={cliente.id}>
                  <strong style={{ fontSize: 18 }}>{cliente.nome}</strong>
                  <p>CPF/CNPJ: {cliente.documento || "nao informado"}</p>
                  <p>E-mail: {cliente.email || "nao informado"}</p>
                  <p>WhatsApp: {cliente.telefone || "nao informado"}</p>
                  <p>{cliente.ativo === false ? "Inativo" : "Ativo"}</p>
                  <button type="button" onClick={() => iniciarEdicaoCliente(cliente)}>Editar</button>
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
