import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

type DoorSystem = 'giro-dupla' | 'correr-dupla' | 'basculante';
type ProfileColor = 'Preto fosco' | 'Bronze' | 'Prata' | 'Dourado' | 'Inox escovado';
type GlassType = 'Reflecta bronze' | 'Reflecta prata' | 'Espelho prata' | 'Incolor' | 'Fumê';
type NumericField = 'height' | 'width' | 'depth' | 'mdfThickness' | 'shelves';

type CabinetConfig = {
  height: number;
  width: number;
  depth: number;
  mdfThickness: number;
  shelves: number;
  doorSystem: DoorSystem;
  profileColor: ProfileColor;
  glassType: GlassType;
};

const defaultConfig: CabinetConfig = {
  height: 2200,
  width: 900,
  depth: 450,
  mdfThickness: 18,
  shelves: 4,
  doorSystem: 'giro-dupla',
  profileColor: 'Preto fosco',
  glassType: 'Reflecta bronze',
};

const foundationCards = [
  {
    title: 'Projetar',
    description: 'Medidas técnicas da cristaleira, escolha de portas, perfil, vidro e preview visual para validação rápida.',
  },
  {
    title: 'Orçar',
    description: 'Cálculo preliminar de área de vidro, metro linear de perfil e dimensões úteis para composição do preço.',
  },
  {
    title: 'Produzir',
    description: 'Base para evoluir para lista de corte, ferragens, componentes, perdas e instruções para a fábrica.',
  },
];

const roadmapItems = [
  'Transformar o preview 2D em ambiente 3D com Three.js',
  'Adicionar biblioteca de perfis ColorGlass por modelo',
  'Gerar plano de corte de alumínio e vidro',
  'Salvar projetos e recuperar histórico pelo Supabase',
];

const doorSystemOptions: { label: string; value: DoorSystem }[] = [
  { label: 'Giro dupla', value: 'giro-dupla' },
  { label: 'Correr dupla', value: 'correr-dupla' },
  { label: 'Basculante', value: 'basculante' },
];

const profileColorOptions: ProfileColor[] = ['Preto fosco', 'Bronze', 'Prata', 'Dourado', 'Inox escovado'];
const glassTypeOptions: GlassType[] = ['Reflecta bronze', 'Reflecta prata', 'Espelho prata', 'Incolor', 'Fumê'];

const numericFields: {
  key: NumericField;
  label: string;
  suffix: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: 'height', label: 'Altura', suffix: 'mm', min: 400, max: 3000, step: 10 },
  { key: 'width', label: 'Largura', suffix: 'mm', min: 300, max: 2400, step: 10 },
  { key: 'depth', label: 'Profundidade', suffix: 'mm', min: 150, max: 800, step: 10 },
  { key: 'mdfThickness', label: 'Espessura MDF', suffix: 'mm', min: 12, max: 25, step: 1 },
  { key: 'shelves', label: 'Prateleiras internas', suffix: 'un', min: 0, max: 8, step: 1 },
];

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function App() {
  const [config, setConfig] = useState<CabinetConfig>(defaultConfig);

  const calculations = useMemo(() => {
    const doorCount = config.doorSystem === 'basculante' ? 1 : 2;
    const internalWidth = Math.max(config.width - config.mdfThickness * 2, 0);
    const internalHeight = Math.max(config.height - config.mdfThickness * 2, 0);
    const internalDepth = Math.max(config.depth - 30, 0);
    const doorGap = config.doorSystem === 'correr-dupla' ? 12 : 6;
    const doorWidth = Math.max((config.width - doorGap) / doorCount, 0);
    const doorHeight = Math.max(config.height - config.mdfThickness * 2, 0);
    const glassAreaM2 = (doorWidth * doorHeight * doorCount) / 1_000_000;
    const profileLinearM = ((doorWidth + doorHeight) * 2 * doorCount) / 1000;
    const shelfAreaM2 = (internalWidth * internalDepth * config.shelves) / 1_000_000;

    return {
      doorCount,
      internalWidth,
      internalHeight,
      internalDepth,
      doorWidth,
      doorHeight,
      glassAreaM2,
      profileLinearM,
      shelfAreaM2,
    };
  }, [config]);

  const setNumberField = (field: NumericField, value: string) => {
    const parsedValue = Number(value);

    setConfig((currentConfig) => ({
      ...currentConfig,
      [field]: Number.isNaN(parsedValue) ? 0 : parsedValue,
    }));
  };

  const previewStyle = {
    width: `${Math.min(72, Math.max(38, (config.width / config.height) * 92))}%`,
  } satisfies CSSProperties;

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
          <span className="eyebrow">MVP · Cristaleira técnica</span>
          <h1>Do briefing ao pré-orçamento em uma tela única.</h1>
          <p>
            Uma primeira base inspirada em plataformas profissionais: apresentação comercial, parâmetros de projeto,
            visualização do móvel e resumo técnico para evoluir depois para 3D, plano de corte e integração com produção.
          </p>

          <div className="hero-actions">
            <a className="primary-button" href="#projetar">Abrir configurador</a>
            <a className="secondary-button" href="#roadmap">Ver roadmap</a>
          </div>
        </div>

        <aside className="hero-panel" aria-label="Resumo do MVP">
          <div className="panel-topline">
            <span>Status</span>
            <strong>Configurador inicial</strong>
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
          <h2>Fluxo base do software</h2>
          <p>O MVP começa com três blocos: configurar, estimar materiais e preparar informação para produção.</p>
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

      <section className="section configurator-section" id="projetar">
        <div className="section-heading wide-heading">
          <span className="eyebrow">Projetar</span>
          <h2>Configurador de cristaleira</h2>
          <p>
            Altere as medidas e opções do produto. O preview e o resumo técnico são atualizados automaticamente.
          </p>
        </div>

        <div className="configurator-layout">
          <form className="config-panel" aria-label="Parâmetros da cristaleira">
            <div className="config-panel-header">
              <span>01</span>
              <div>
                <h3>Parâmetros técnicos</h3>
                <p>Medidas principais do módulo e definição da porta.</p>
              </div>
            </div>

            <div className="field-grid">
              {numericFields.map((field) => (
                <label className="field" key={field.key}>
                  <span>{field.label}</span>
                  <div className="input-shell">
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={config[field.key]}
                      onChange={(event) => setNumberField(field.key, event.currentTarget.value)}
                    />
                    <small>{field.suffix}</small>
                  </div>
                </label>
              ))}
            </div>

            <label className="field full-field">
              <span>Sistema de porta</span>
              <select
                value={config.doorSystem}
                onChange={(event) =>
                  setConfig((currentConfig) => ({
                    ...currentConfig,
                    doorSystem: event.currentTarget.value as DoorSystem,
                  }))
                }
              >
                {doorSystemOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="field-grid two-columns">
              <label className="field">
                <span>Cor do perfil</span>
                <select
                  value={config.profileColor}
                  onChange={(event) =>
                    setConfig((currentConfig) => ({
                      ...currentConfig,
                      profileColor: event.currentTarget.value as ProfileColor,
                    }))
                  }
                >
                  {profileColorOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Tipo de vidro</span>
                <select
                  value={config.glassType}
                  onChange={(event) =>
                    setConfig((currentConfig) => ({
                      ...currentConfig,
                      glassType: event.currentTarget.value as GlassType,
                    }))
                  }
                >
                  {glassTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </form>

          <div className="preview-panel" aria-label="Preview técnico da cristaleira">
            <div className="preview-header">
              <div>
                <span className="eyebrow compact-eyebrow">Preview</span>
                <h3>Cristaleira frontal</h3>
              </div>
              <div className="dimension-pill">
                {config.width} × {config.height} mm
              </div>
            </div>

            <div className="technical-preview">
              <div className="preview-cabinet" style={previewStyle}>
                <div className="preview-door left-door" />
                {calculations.doorCount > 1 && <div className="preview-door right-door" />}
                {Array.from({ length: config.shelves }).map((_, index) => (
                  <span
                    className="preview-shelf"
                    key={`shelf-${index + 1}`}
                    style={{ top: `${((index + 1) / (config.shelves + 1)) * 100}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="preview-meta">
              <span>{config.profileColor}</span>
              <span>{config.glassType}</span>
              <span>{calculations.doorCount} porta(s)</span>
            </div>
          </div>

          <aside className="summary-panel" id="fabricar" aria-label="Resumo técnico do projeto">
            <div className="config-panel-header">
              <span>02</span>
              <div>
                <h3>Resumo automático</h3>
                <p>Estimativa preliminar para orçamento e produção.</p>
              </div>
            </div>

            <dl className="summary-list">
              <div>
                <dt>Vão interno</dt>
                <dd>
                  {formatNumber(calculations.internalWidth, 0)} × {formatNumber(calculations.internalHeight, 0)} ×{' '}
                  {formatNumber(calculations.internalDepth, 0)} mm
                </dd>
              </div>
              <div>
                <dt>Medida por porta</dt>
                <dd>
                  {formatNumber(calculations.doorWidth, 0)} × {formatNumber(calculations.doorHeight, 0)} mm
                </dd>
              </div>
              <div>
                <dt>Área de vidro</dt>
                <dd>{formatNumber(calculations.glassAreaM2)} m²</dd>
              </div>
              <div>
                <dt>Perfil estimado</dt>
                <dd>{formatNumber(calculations.profileLinearM)} m linear</dd>
              </div>
              <div>
                <dt>Área de prateleiras</dt>
                <dd>{formatNumber(calculations.shelfAreaM2)} m²</dd>
              </div>
            </dl>

            <button className="ghost-button" type="button">
              Exportar briefing técnico
            </button>
          </aside>
        </div>
      </section>

      <section className="section sales-section" id="vender">
        <div className="section-heading">
          <span className="eyebrow">Vender</span>
          <h2>Posicionamento comercial</h2>
          <p>
            A página já começa a seguir uma lógica parecida com softwares profissionais: mostrar valor, demonstrar produto e
            depois levar o cliente para uma configuração orientada.
          </p>
        </div>
      </section>

      <section className="section roadmap" id="roadmap">
        <div className="section-heading">
          <span className="eyebrow">Próximo passo</span>
          <h2>O que entra depois do configurador base</h2>
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
