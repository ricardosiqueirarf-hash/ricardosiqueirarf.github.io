"use client";

import { useState } from "react";

const integracoes = [
  {
    nome: "API Asaas",
    descricao: "Cobranças, boletos, PIX, links de pagamento e acompanhamento financeiro conectado ao orçamento.",
  },
  {
    nome: "API Inter",
    descricao: "Conexão bancária para Pix, extrato, conciliação e operações financeiras automatizadas.",
  },
  {
    nome: "API ChatGPT",
    descricao: "Assistente inteligente para atendimento, interpretação de pedidos, automações e suporte operacional.",
  },
];

export default function AjustesPanel({ empresaSlug }: { empresaSlug: string }) {
  const [modo, setModo] = useState<"escuro" | "claro">("escuro");

  return (
    <section className="card settings-panel" style={{ maxWidth: "none" }}>
      <div className="settings-hero">
        <div className="settings-logo-block">
          <div className="settings-logo-mark">A</div>
          <div>
            <p className="dashboard-kicker">Configurações do ambiente</p>
            <h1>Ajustes</h1>
            <p>Identidade, aparência, preferências e integrações futuras da empresa.</p>
          </div>
        </div>
        <div className="settings-company-pill">Empresa: {empresaSlug || "-"}</div>
      </div>

      <div className="settings-grid">
        <article className="metric settings-card">
          <strong>Identidade visual</strong>
          <p>Logo e marca do ambiente ANODIZA.</p>
          <div className="settings-brand-preview">
            <div className="settings-logo-mark">A</div>
            <div>
              <strong>ANODIZA</strong>
              <p>SaaS industrial</p>
            </div>
          </div>
          <button type="button" disabled>Alterar logo em breve</button>
        </article>

        <article className="metric settings-card">
          <strong>Modo visual</strong>
          <p>Alternância visual do sistema. O modo claro será aplicado futuramente no ambiente completo.</p>
          <div className="settings-mode-toggle" role="group" aria-label="Modo visual">
            <button type="button" className={modo === "escuro" ? "settings-mode-active" : ""} onClick={() => setModo("escuro")}>Escuro</button>
            <button type="button" className={modo === "claro" ? "settings-mode-active" : ""} onClick={() => setModo("claro")}>Claro</button>
          </div>
          <p>Modo selecionado: <strong>{modo === "escuro" ? "Escuro" : "Claro"}</strong></p>
        </article>

        <article className="metric settings-card">
          <strong>Preferências operacionais</strong>
          <p>Configurações gerais da empresa, permissões padrão e comportamento do sistema.</p>
          <button type="button" disabled>Configurar em breve</button>
        </article>
      </div>

      <section className="settings-integrations">
        <div>
          <p className="dashboard-kicker">Integrações futuras</p>
          <h2>APIs e automações contratadas</h2>
          <p>Essas integrações ainda não estão liberadas. Futuramente serão ativadas mediante contrato com a ANODIZA, com configuração, segurança e suporte de implantação.</p>
        </div>

        <div className="settings-integration-grid">
          {integracoes.map((integracao) => (
            <article className="metric settings-integration-card" key={integracao.nome}>
              <span className="settings-lock">Bloqueado</span>
              <strong>{integracao.nome}</strong>
              <p>{integracao.descricao}</p>
              <button type="button" disabled>Disponível mediante contrato</button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
