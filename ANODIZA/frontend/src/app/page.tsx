import Link from "next/link";

const metrics = [
  { label: "Orcamentos aprovados", value: "128", trend: "+18%" },
  { label: "Conversao media", value: "42%", trend: "+7%" },
  { label: "Faturamento", value: "121.765,56", trend: "mes" },
];

const features = [
  "Orcamentos inteligentes para portas de aluminio e vidro",
  "Gestao multiempresa com usuarios, permissoes e auditoria",
  "Base pronta para WhatsApp, CRM, pagamentos e producao",
];

export default function HomePage() {
  return (
    <main className="home-page">
      <div className="home-noise" aria-hidden="true" />
      <div className="home-orb home-orb-one" aria-hidden="true" />
      <div className="home-orb home-orb-two" aria-hidden="true" />
      <div className="home-grid-bg" aria-hidden="true" />

      <nav className="home-nav" aria-label="Navegacao principal">
        <Link href="/" className="home-logo" aria-label="ANODIZA inicio">
          <span className="home-logo-mark">A</span>
          <span>
            <strong>ANODIZA</strong>
            <small>SaaS industrial</small>
          </span>
        </Link>
        <div className="home-nav-actions">
          <Link href="/login" className="home-nav-link">Entrar</Link>
          <Link href="/cadastro" className="home-nav-cta">Comecar agora</Link>
        </div>
      </nav>

      <section className="home-hero">
        <div className="home-hero-copy">
          <div className="home-badge">
            <span className="home-badge-dot" />
            Plataforma SaaS para vidro e aluminio
          </div>

          <h1>
            O sistema premium para empresas de <span>portas de aluminio e vidro.</span>
          </h1>

          <p className="home-subtitle">
            Centralize clientes, orcamentos e usuarios em uma base moderna,
            escalavel e pronta para transformar operacoes moveleiras em software de alta performance.
          </p>

          <div className="home-hero-actions">
            <Link href="/cadastro" className="home-primary-button">
              Criar primeiro acesso
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/login" className="home-secondary-button">
              Acessar painel
            </Link>
          </div>

          <div className="home-trust-row" aria-label="Destaques do produto">
            <span>Multiempresa</span>
            <span>Permissoes</span>
            <span>Auditoria</span>
            <span>API-ready</span>
          </div>
        </div>

        <div className="home-hero-visual" aria-label="Previa visual do painel ANODIZA">
          <div className="home-dashboard-shell">
            <div className="home-dashboard-topbar">
              <div className="home-window-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="home-search-pill">Buscar pedido, cliente</div>
            </div>

            <div className="home-dashboard-body">
              <aside className="home-dashboard-sidebar" aria-hidden="true">
                <span className="active" />
                <span />
                <span />
                <span />
              </aside>

              <div className="home-dashboard-content">
                <div className="home-panel-heading">
                  <div>
                    <small>Visao geral</small>
                    <strong>Operacao em tempo real</strong>
                  </div>
                  <span>Online</span>
                </div>

                <div className="home-metrics-grid">
                  {metrics.map((metric) => (
                    <div className="home-metric-card" key={metric.label}>
                      <small>{metric.label}</small>
                      <strong>{metric.value}</strong>
                      <span>{metric.trend}</span>
                    </div>
                  ))}
                </div>

                <div className="home-production-card">
                  <div className="home-production-info">
                    <small>Relatorio</small>
                    <strong>Gestao de estoque</strong>
                    <p>Perfis • vidros • insumos • reposicao inteligente</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-feature-strip" aria-label="Recursos principais">
        {features.map((feature, index) => (
          <article className="home-feature-card" key={feature}>
            <span>0{index + 1}</span>
            <p>{feature}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
