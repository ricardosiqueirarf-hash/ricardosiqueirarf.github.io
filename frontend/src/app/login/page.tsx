"use client";

import Link from "next/link";
import { useState } from "react";
import { apiPost } from "@/lib/api";

export default function LoginPage() {
  const [empresaSlug, setEmpresaSlug] = useState("anodiza");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagem, setMensagem] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("Entrando...");

    try {
      await apiPost("/api/auth/login", {
        empresa_slug: empresaSlug,
        email,
        senha,
      });
      setMensagem("Login recebido. A validacao completa entra na proxima etapa.");
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
            <p>Sistema white-label</p>
          </div>
        </div>

        <h1>Entrar</h1>
        <p>Acesse o painel da sua loja.</p>

        <form onSubmit={handleSubmit}>
          <label>
            Empresa
            <input value={empresaSlug} onChange={(event) => setEmpresaSlug(event.target.value)} />
          </label>
          <label>
            E-mail
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Senha
            <input type="password" value={senha} onChange={(event) => setSenha(event.target.value)} />
          </label>
          <button type="submit">Entrar</button>
        </form>

        {mensagem && <p style={{ marginTop: 16 }}>{mensagem}</p>}
        <p style={{ marginTop: 18 }}>
          Ainda nao tem conta? <Link href="/cadastro">Criar cadastro</Link>
        </p>
      </section>
    </main>
  );
}
