"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPost } from "@/lib/api";

type AuthResponse = {
  access_token: string;
  empresa_slug: string;
  usuario: { nome: string; email: string; perfil?: string; permissoes?: Record<string, boolean> };
};

export default function CadastroPage() {
  const router = useRouter();
  const [mensagem, setMensagem] = useState("");
  const [form, setForm] = useState({ empresa_nome: "", loja_nome: "", nome: "", email: "", senha: "" });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("Criando cadastro...");
    try {
      const data = await apiPost<AuthResponse>("/api/auth/cadastro", form);
      localStorage.setItem("anodiza_token", data.access_token);
      localStorage.setItem("anodiza_empresa_slug", data.empresa_slug);
      localStorage.setItem("anodiza_usuario", JSON.stringify({ ...data.usuario, perfil: data.usuario.perfil || "owner" }));
      setMensagem(`Cadastro criado. Empresa: ${data.empresa_slug}`);
      router.push("/loja");
    } catch {
      setMensagem("Nao foi possivel criar o cadastro. Confira os dados e tente novamente.");
    }
  }

  return (
    <main className="page-shell">
      <section className="card">
        <div className="brand"><div className="brand-mark">A</div><div><strong>ANODIZA</strong><p>Novo ambiente</p></div></div>
        <h1>Criar cadastro</h1>
        <p>Crie a empresa, a primeira loja e o usuario principal. O identificador da empresa sera gerado automaticamente.</p>
        <form onSubmit={handleSubmit}>
          <label>Nome da empresa<input value={form.empresa_nome} onChange={(event) => updateField("empresa_nome", event.target.value)} /></label>
          <label>Nome da loja<input value={form.loja_nome} onChange={(event) => updateField("loja_nome", event.target.value)} /></label>
          <label>Seu nome<input value={form.nome} onChange={(event) => updateField("nome", event.target.value)} /></label>
          <label>E-mail<input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} /></label>
          <label>Senha<input type="password" value={form.senha} onChange={(event) => updateField("senha", event.target.value)} /></label>
          <button type="submit">Criar ambiente</button>
        </form>
        {mensagem && <p style={{ marginTop: 16 }}>{mensagem}</p>}
        <p style={{ marginTop: 18 }}>Ja tem cadastro? <Link href="/login">Entrar</Link></p>
      </section>
    </main>
  );
}
