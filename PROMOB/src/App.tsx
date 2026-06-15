const foundationCards = [
  {
    title: 'Projetar',
    description: 'Base para receber o configurador visual da cristaleira, com foco em medidas, módulos e preview técnico.',
  },
  {
    title: 'Orçar',
    description: 'Estrutura preparada para depois calcular vidro, alumínio, MDF, ferragens, perdas e valor final.',
  },
  {
    title: 'Produzir',
    description: 'Próxima etapa será transformar o projeto em lista de corte, componentes e instruções para fábrica.',
  },
];

const roadmapItems = [
  'Criar layout inspirado em software comercial premium',
  'Adicionar formulário técnico da cristaleira',
  'Criar preview 3D com Three.js / React Three Fiber',
  'Gerar resumo de medidas e materiais',
];

function App() {
  return (
    <main className="app-shell">
      <header className="site-header" aria-label="Cabeçalho principal">
        <a className="brand" href="#top" aria-label="PROMOB MVP início">
          <span className="brand-mark">P</span>
          <span>
            <strong>PROMOB MVP</strong>
            <small>Configurador ColorGlass</small>
          </span>
        </a>

        <nav className="main-nav" aria-label="Navegação principal">
          <a href="#produtos">Produtos</a>
          <a href="#projetar">Projetar</a>
          <a href="#fabricar">Fabricar</a>
          <a href="#vender">Vender</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-content">
          <span className="eyebrow">Passo 1 · Fundação do app</span>
          <h1>Base inicial para um configurador técnico com aparência de software profissional.</h1>
          <p>
            Esta etapa organiza o projeto React/Vite dentro da pasta PROMOB e cria a primeira estrutura visual para evoluir
            depois para um site parecido com a Promob real: institucional, comercial e com configurador de produto.
          </p>

          <div className="hero-actions">
            <a className="primary-button" href="#produtos">Ver estrutura</a>
            <a className="secondary-button" href="#roadmap">Próximas melhorias</a>
          </div>
        </div>

        <aside className="hero-panel" aria-label="Resumo do MVP">
          <div className="panel-topline">
            <span>Status</span>
            <strong>Estrutura criada</strong>
          </div>
          <div className="mock-window">
            <div className="mock-toolbar">
              <span />
              <span />
              <span />
            </div>
            <div className="mock-grid">
              <div className="mock-sidebar" />
              <div className="mock-preview">
                <div className="cabinet-outline">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="section" id="produtos">
        <div className="section-heading">
          <span className="eyebrow">Estrutura do produto</span>
          <h2>Primeiros blocos do MVP</h2>
          <p>
            A base foi pensada para crescer em três direções: projeto visual, orçamento técnico e produção.
          </p>
        </div>

        <div className="card-grid">
          {foundationCards.map((card) => (
            <article className="feature-card" key={card.title}>
              <span>{card.title}</span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section roadmap" id="roadmap">
        <div className="section-heading">
          <span className="eyebrow">Próximo passo</span>
          <h2>O que entra depois da fundação</h2>
        </div>

        <ol className="roadmap-list">
          {roadmapItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}

export default App;
