import React from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { ConfiguratorScene } from './shared3d';
import './split.css';

const MOBIL_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://uyssmueddxtylajnmxad.supabase.co';
const MOBIL_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_YVwgZbFAqi5M4N1i-Iwgdg_7GTzwxrw';
const supabase = createClient(MOBIL_URL, MOBIL_KEY);

type Factory = { id: string; name: string; slug: string; status: string };
type Modelo = { id: string; nome: string; categoria: string; objetos: any[]; parametros_padrao: any };

function LojaApp() {
  const [lojaName, setLojaName] = React.useState('Minha loja');
  const [factories, setFactories] = React.useState<Factory[]>([]);
  const [factoryId, setFactoryId] = React.useState(localStorage.getItem('mobil-active-factory') || '');
  const [modelos, setModelos] = React.useState<Modelo[]>([]);
  const [modeloId, setModeloId] = React.useState('');
  const [custom, setCustom] = React.useState({ w: 1000, h: 2200, d: 450, margemLoja: 25 });
  const [msg, setMsg] = React.useState('Escolha uma fábrica para importar a biblioteca dela.');

  React.useEffect(() => {
    supabase.from('mobil_factories').select('id,name,slug,status').eq('status', 'active').order('name').then(({ data, error }) => {
      if (error) {
        setMsg('Não consegui carregar fábricas. Use demonstração ou cadastre uma fábrica.');
        return;
      }
      setFactories((data || []) as Factory[]);
    });
  }, []);

  React.useEffect(() => {
    if (!factoryId) return;
    supabase.from('mobil_modelos_factory').select('*').eq('factory_id', factoryId).eq('ativo', true).order('nome').then(({ data, error }) => {
      if (error) {
        setModelos([]);
        setMsg('Fábrica escolhida, mas não consegui carregar modelos publicados.');
        return;
      }
      const loaded = (data || []) as Modelo[];
      setModelos(loaded);
      if (loaded[0]) {
        setModeloId(loaded[0].id);
        const p = loaded[0].parametros_padrao || {};
        setCustom({ w: Number(p.largura || 1000), h: Number(p.altura || 2200), d: Number(p.profundidade || 450), margemLoja: 25 });
      }
      setMsg(`Biblioteca importada: ${loaded.length} modelos disponíveis.`);
    });
  }, [factoryId]);

  function importFactory(nextFactoryId: string) {
    setFactoryId(nextFactoryId);
    localStorage.setItem('mobil-active-factory', nextFactoryId);
    const factory = factories.find((item) => item.id === nextFactoryId);
    setMsg(factory ? `Loja trabalhando com biblioteca da fábrica ${factory.name}.` : 'Fábrica importada.');
  }

  const activeFactory = factories.find((item) => item.id === factoryId) || null;
  const activeModel = modelos.find((item) => item.id === modeloId) || null;
  const factoryCost = Number(activeModel?.parametros_padrao?.custo || 0);
  const factoryMargin = Number(activeModel?.parametros_padrao?.margem || 45);
  const factoryBasePrice = factoryCost > 0 ? factoryCost / (1 - factoryMargin / 100) : 0;
  const storePrice = factoryBasePrice > 0 ? factoryBasePrice / (1 - custom.margemLoja / 100) : 0;

  return (
    <main className="splitApp storeMode">
      <aside className="splitSide">
        <div className="splitBrand"><span>MOBIL Loja</span><h1>Configurador 3D da loja</h1><p>Escolha uma fábrica, importe a biblioteca dela e adapte o projeto para o cliente.</p></div>
        <div className="splitBlock"><h2>Loja</h2><label>Nome da loja<input value={lojaName} onChange={(e) => setLojaName(e.target.value)} /></label></div>
        <div className="splitBlock"><h2>Escolher fábrica</h2><label>Fábrica parceira<select value={factoryId} onChange={(e) => importFactory(e.target.value)}><option value="">Selecione</option>{factories.map((factory) => <option value={factory.id} key={factory.id}>{factory.name}</option>)}</select></label><p>{activeFactory ? `Biblioteca ativa: ${activeFactory.name}` : 'Nenhuma fábrica escolhida.'}</p></div>
        <div className="splitBlock"><h2>Modelo importado</h2><label>Modelo<select value={modeloId} onChange={(e) => setModeloId(e.target.value)}><option value="">Selecione</option>{modelos.map((modelo) => <option value={modelo.id} key={modelo.id}>{modelo.nome}</option>)}</select></label><label>Largura<input type="number" value={custom.w} onChange={(e) => setCustom({ ...custom, w: Number(e.target.value) })} /></label><label>Altura<input type="number" value={custom.h} onChange={(e) => setCustom({ ...custom, h: Number(e.target.value) })} /></label><label>Profundidade<input type="number" value={custom.d} onChange={(e) => setCustom({ ...custom, d: Number(e.target.value) })} /></label><label>Margem da loja %<input type="number" value={custom.margemLoja} onChange={(e) => setCustom({ ...custom, margemLoja: Number(e.target.value) })} /></label></div>
      </aside>
      <section className="splitMain"><div className="splitTop"><div><span>Modo loja</span><b>Projeto em cima da biblioteca da fábrica</b><small>A loja adapta medidas e preço comercial; a regra técnica vem da fábrica.</small></div><a className="splitGhost" href="/fabrica.html">Abrir MOBIL Fábrica</a></div><ConfiguratorScene title={activeModel?.nome || 'Modelo da fábrica'} module={{ w: custom.w, h: custom.h, d: custom.d }} color="#805b38" /></section>
      <aside className="splitResult"><div className="splitBrand"><span>Resumo comercial</span><h1>{activeModel?.nome || 'Sem modelo'}</h1><p>{msg}</p></div><div className="metric"><span>Fábrica</span><b>{activeFactory?.name || '—'}</b></div><div className="metric"><span>Preço base fábrica</span><b>{factoryBasePrice ? `R$ ${factoryBasePrice.toFixed(2)}` : '—'}</b></div><div className="metric"><span>Preço loja sugerido</span><b>{storePrice ? `R$ ${storePrice.toFixed(2)}` : '—'}</b></div><div className="splitBlock"><h2>Modelos importados</h2>{modelos.length === 0 ? <p>Nenhum modelo importado ainda.</p> : modelos.map((item) => <div className="listItem" key={item.id}><b>{item.nome}</b><small>{item.categoria}</small></div>)}</div></aside>
    </main>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<LojaApp />);
