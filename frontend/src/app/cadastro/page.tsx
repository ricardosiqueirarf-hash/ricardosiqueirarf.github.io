"use client";

import Link from "next/link";
import { useState } from "react";
import { apiPost } from "@/lib/api";

export default function CadastroPage() {
  const [mensagem, setMensagem] = useState("");
  const [form, setForm] = useState({
    empresa_nome: "",
    empresa_slug: "",
    loja_nome: "",
    nome: "",
    email: "",
    senha: "",
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("Criando cadastro...");

    try {
      await apiPost("/api/auth/cadastro", form);
      setMensagem("Cadastro recebido. A gravacao completa entra na proxima etapa.");
    } catch {
      setMensagem("Nao foi possivel conectar com a API.");
    }
  }

  return (
    <main className="page-shell">
      <section className="card">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>ANODIZA</strong>
            <p>Novo ambiente de loja</p>
          </div>
        </div>

        <h1>Criar cadastro</h1>
        <p>Crie a empresa, a primeira loja e o usuario principal.</p>

        <form onSubmit={handleSubmit}>
          <label>
            Nome da empresa
            <input value={form.empresa_nome} onChange={(event) => updateField("empresa_nome", event.target.value)} />
          </label>
          <label>
            Slug da empresa
            <input value={form.empresa_slug} onChange={(event) => updateField("empresa_slug", event.target.value)} />
          </label>
          <label>
            Nome da loja
            <input value={form.loja_nome} onChange={(event) => updateField("loja_nome", event.target.value)} />
          </label>
          <label>
            Seu nome
            <input value={form.nome} onChange={(event) => updateField("nome", event.target.value)} />
          </label>
          <label>
            E-mail
            <input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
          </label>
          <label>
            Senha
            <input type="password" value={form.senha} onChange={(event) => updateField("senha", event.target.value)} />
          </label>
          <button type="submit">Criar ambiente</button>
        </form>

        {mensagem && <p style={{ marginTop: 16 }}>{mensagem}</p>}
        <p style={{ marginTop: 18 }}>
          Ja tem cadastro? <Link href="/login">Entrar</Link>
        </p>
      </section>
    </main>
  );
}
