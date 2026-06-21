import Link from "next/link";

const tags = [
  { icon: "◈", label: "ORCAMENTO 3D" },
  { icon: "⚙", label: "REGRAS PROPRIAS" },
  { icon: "▦", label: "MULTIEMPRESA" },
  { icon: "⛓", label: "API-READY" },
];

const cards = [
  {
    icon: "◈",
    title: "Orcamento de portas e estruturas 3D",
    body: "Calcule com suas regras de precificacao e va alem, orcando estruturas complexas em 3D.",
  },
  {
    icon: "⚙",
    title: "Regras de negocio sob medida",
    body: "O Anodiza se adapta as suas regras de precificacao, nao o contrario.",
  },
  {
    icon: "◉",
    title: "Financeiro centralizado de verdade",
    body: "Integracao nativa com Inter, Asaas, Santander e outros bancos.",
  },
];

export default function HomePage() {
  return (
    <main className="reference-page">
      <section className="reference-hero">
        <svg className="reference-hero-bg" viewBox="0 0 1100 760" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <radialGradient id="anodizaGlow1" cx="80%" cy="8%" r="55%">
              <stop offset="0%" stopColor="#3a2c0a" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#070705" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="anodizaGlow2" cx="5%" cy="92%" r="40%">
              <stop offset="0%" stopColor="#1a1408" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#070705" stopOpacity="0" />
            </radialGradient>
            <pattern id="anodizaGrid" width="34" height="34" patternUnits="userSpaceOnUse">
              <path d="M0 34L34 34L34 0" fill="none" stroke="#E8C158" strokeOpacity="0.06" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="1100" height="760" fill="#070705" />
          <rect width="1100" height="760" fill="url(#anodizaGrid)" />
          <rect width="1100" height="760" fill="url(#anodizaGlow1)" />
          <rect width="1100" height="760" fill="url(#anodizaGlow2)" />
        </svg>

        <div className="reference-hero-content">
          <nav className="reference-navbar" aria-label="Navegacao principal">
            <Link href="/" className="reference-logo" aria-label="ANODIZA inicio">
              <span className="reference-logo-mark">A</span>
              <span>
                <strong>ANODIZA</strong>
                <small>SAAS INDUSTRIAL</small>
              </span>
            </Link>

            <div className="reference-nav-actions">
              <Link href="/login" className="reference-nav-login">Entrar</Link>
              <Link href="/cadastro" className="reference-nav-button">Comecar agora</Link>
            </div>
          </nav>

          <span className="reference-badge">
            <span className="reference-dot" />
            Plataforma SaaS para empresas de portas de aluminio e vidro
          </span>

          <h1 className="reference-title">
            O unico sistema que orca <span>portas e estruturas 3D</span> de aluminio e vidro com as regras do seu negocio.
          </h1>

          <p className="reference-subtitle">
            Centralize orcamentos, estoque, financeiro e clientes em uma unica plataforma — moldada para a forma como sua empresa realmente trabalha, com integracao direta a Inter, Asaas, Santander e mais.
          </p>

          <div className="reference-cta-row">
            <Link href="/cadastro" className="reference-cta-primary">
              Testar gratuitamente
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/login" className="reference-cta-secondary">Acessar painel</Link>
          </div>

          <div className="reference-tags" aria-label="Funcionalidades principais">
            {tags.map((tag) => (
              <span className="reference-tag" key={tag.label}>
                <span aria-hidden="true">{tag.icon}</span>
                {tag.label}
              </span>
            ))}
          </div>

          <div className="reference-cards-grid">
            {cards.map((card) => (
              <article className="reference-card" key={card.title}>
                <div className="reference-card-icon" aria-hidden="true">{card.icon}</div>
                <h2>{card.title}</h2>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
