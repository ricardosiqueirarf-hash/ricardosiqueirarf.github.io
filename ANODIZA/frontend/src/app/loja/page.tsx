"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type Usuario = { id: string; nome: string; email: string; perfil: string; ativo?: boolean };
type LojaIndex = { titulo: string; cards: { label: string; valor: number }[] };
type Aba = "painel" | "usuarios";

const fallbackIndex: LojaIndex = {
  titulo: "Painel da Loja",
  cards: [
    { label: "Orcamentos", valor: 0 },
    { label: "Aprovados", valor: 0 },
    { label: "Em producao", valor: 0 },
  ],
};

export default function LojaPage() {
  const [abaAtiva, setAbaAtiva] = useState<Aba>("painel");
  const [data, setData] = useState<LojaIndex>(fallbackIndex);
  const [empresaSlug, setEmpresaSlug] = useState("");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [novoUsuario, setNovoUsuario] = useState({ nome: "", email: "", perfil: "vendedor" });

  async function carregarUsuarios(slug: string) {
    if (!slug) return;
    try {
      const lista = await apiGet<Usuario[]>(`/api/loja/usuarios?empresa_slug=${slug}`);
      setUsuarios(lista);
    } catch {
      setUsuarios([]);
    }
  }

  useEffect(() => {
    const slug = localStorage.getItem("anodiza_empresa_slug") || "";
    setEmpresaSlug(slug);
    apiGet<LojaIndex>("/api/loja/index").then(setData).catch(() => setData(fallbackIndex));
    carregarUsuarios(slug);
  }, []);

  async function abrirAbaUsuarios() {
    setAbaAtiva("usuarios");
    await carregarUsuarios(empresaSlug);
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
