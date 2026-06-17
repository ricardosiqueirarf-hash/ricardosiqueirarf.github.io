"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type Usuario = { id: string; nome: string; email: string; perfil: string; ativo?: boolean };
type LojaIndex = { titulo: string; cards: { label: string; valor: number }[] };

const fallbackIndex: LojaIndex = {
  titulo: "Painel da Loja",
  cards: [
    { label: "Orcamentos", valor: 0 },
    { label: "Aprovados", valor: 0 },
    { label: "Em producao", valor: 0 },
  ],
};

export default function LojaPage() {
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
    } catch {
      setMensagem("Nao foi possivel criar o usuario.");
    }
  }

  return (
    <main className="dashboard">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">A</div><div><strong>ANODIZA</strong><p>Loja</p></div></div>
        <p>Empresa ativa: {empresaSlug || "nao identificada"}</p>
      </aside>
      <section className="main">
        <h1>{data.titulo}</h1>
        <p>Usuario master pode criar outros usuarios da empresa.</p>
        <div className="grid">
          {data.cards.map((card) => (
            <div className="metric" key={card.label}>
              <p>{card.label}</p>
              <strong>{card.valor}</strong>
            </div>
          ))}
        </div>

        <section className="card" style={{ maxWidth: "none", marginTop: 24 }}>
          <h2>Usuarios</h2>
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
                <p>{usuario.email} • {usuario.perfil}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
