import Link from "next/link";

const metrics = [
  { label: "Orcamentos aprovados", value: "128", trend: "+18%" },
  { label: "Conversao media", value: "42%", trend: "+7%" },
  { label: "Base de clientes", value: "45", trend: "+14%" },
];

const features = [
  {
    title: "Orcamento de portas e estruturas 3D",
    body: "Calcule portas de aluminio e vidro com suas proprias regras de precificacao — e avance para estruturas complexas em tres dimensoes, sem depender de planilhas ou modelos fixos.",
  },
  {
    title: "Regras de negocio sob medida",
    body: "Cada empresa tem sua propria forma de precificar. O Anodiza se adapta as suas regras, nao o contrario.",
  },
  {
    title: "Financeiro centralizado de verdade",
    body: "Organize recebimentos, pagamentos e conciliacao em uma base pronta para integracao com Inter, Asaas, Santander e outros bancos.",
  },
];

const ecosystem = ["CRM", "ERP", "WhatsApp", "Inter", "Asaas", "Santander", "API-ready"];

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
            Plataforma SaaS para empresas de portas de aluminio e vidro
          </div>

          <h1>
            Orce portas de aluminio, vidro e estruturas 3D <span>com as regras do seu negocio.</span>
          </h1>

          <p className="home-subtitle">
            Centralize orcamentos, estoque, financeiro e clientes em uma plataforma moldada
            para a forma como sua empresa realmente precifica, produz e vende.
          </p>

          <div className="home-hero-actions">
            <Link href="/cadastro" className="home-primary-button">
              Testar gratuitamente
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/login" className="home-secondary-button">
              Acessar painel
            </Link>
          </div>

          <div className="home-trust-row" aria-label="Destaques do produto">
            <span>Orcamento 3D</span>
            <span>Regras proprias</span>
            <span>Multiempresa</span>
            <span>Integracoes</span>
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

      <section className="home-feature-strip" aria-label="Diferenciais principais">
        {features.map((feature, index) => (
          <article className="home-feature-card" key={feature.title}>
            <span>0{index + 1}</span>
            <strong>{feature.title}</strong>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>

      <section className="home-content-section">
        <p className="home-section-kicker">Para quem decide</p>
        <h2>Feito para quem dirige a operacao, nao so para quem usa o sistema</h2>
        <p>
          Voce nao precisa de mais uma ferramenta generica de gestao. Precisa de um sistema que entenda
          como sua fabrica ou loja realmente orca, produz, cobra e entrega — crescendo junto com as regras
          especificas do seu negocio.
        </p>
      </section>

      <section className="home-content-section home-ecosystem-section">
        <p className="home-section-kicker">Ecossistema</p>
        <h2>Construido para se conectar com o que voce ja usa</h2>
        <p>
          APIs para CRM, ERP, WhatsApp e os principais bancos do mercado — para parar de operar em silos.
        </p>
        <div className="home-ecosystem-row" aria-label="Integracoes e canais">
          {ecosystem.map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>
    </main>
  );
}
