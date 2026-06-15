import React from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { ConfiguratorScene } from './shared3d';
import './split.css';

const MOBIL_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://uyssmueddxtylajnmxad.supabase.co';
const MOBIL_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_YVwgZbFAqi5M4N1i-Iwgdg_7GTzwxrw';
const supabase = createClient(MOBIL_URL, MOBIL_KEY);

type Factory = { id: string; name: string; slug: string; status: string };
type Loja = { id: string; name: string; slug: string; status: string };
type Modelo = { id: string; nome: string; categoria: string; objetos: any[]; parametros_padrao: any; edicoes_permitidas?: any };

type CustomProject = { w: number; h: number; d: number; margemLoja: number; vidro: string; acabamento: string; portas: number; prateleiras: number };

function slugify(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `loja-${Date.now()}`;
}

function customFromModel(modelo: Modelo | null): CustomProject {
  const p = modelo?.parametros_padrao || {};
  return {
    w: Number(p.largura || 1000),
    h: Number(p.altura || 2200),
    d: Number(p.profundidade || 450),
    margemLoja: 25,
    vidro: p.vidro || 'reflecta_bronze',
    acabamento: p.acabamento || 'preto_fosco',
    portas: Number(p.portas || 2),
    prateleiras: Number(p.prateleiras || 4),
  };
}

function LojaApp() {
  const [lojaName, setLojaName] = React.useState(localStorage.getItem('mobil-loja-name') || 'Minha loja');
  const [lojaId, setLojaId] = React.useState(localStorage.getItem('mobil-loja-id') || '');
  const [factories, setFactories] = React.useState<Factory[]>([]);
  const [factoryId, setFactoryId] = React.useState(localStorage.getItem('mobil-active-factory') || '');
  const [modelos, setModelos] = React.useState<Modelo[]>([]);
  const [modeloId, setModeloId] = React.useState('');
  const [custom, setCustom] = React.useState<CustomProject>({ w: 1000, h: 2200, d: 450, margemLoja: 25, vidro: 'reflecta_bronze', acabamento: 'preto_fosco', portas: 2, prateleiras: 4 });
  const [msg, setMsg] = React.useState('Escolha uma fabrica para importar a biblioteca dela.');

  React.useEffect(() => {
    supabase.from('mobil_factories').select('id,name,slug,status').eq('status', 'active').order('name').then(({ data, error }) => {
      if (error) {
        setMsg('Nao consegui carregar fabricas. Use demonstracao ou cadastre uma fabrica.');
        return;
      }
      setFactories((data || []) as Factory[]);
    });
  }, []);

  React.useEffect(() => {
    if (!factoryId) return;
    supabase.from('mobil_modelos_factory').select('id,nome,categoria,objetos,parametros_padrao,edicoes_permitidas').eq('factory_id', factoryId).eq('ativo', true).order('nome').then(({ data, error }) => {
      if (error) {
        setModelos([]);
        setMsg('Fabrica escolhida, mas nao consegui carregar modelos publicados.');
        return;
      }
      const loaded = (data || []) as Modelo[];
      setModelos(loaded);
      if (loaded[0]) selectModelo(loaded[0], loaded);
      setMsg(`Biblioteca importada: ${loaded.length} templates disponiveis.`);
    });
  }, [factoryId]);

  function selectModeloById(id: string) {
    const found = modelos.find((item) => item.id === id) || null;
    if (found) selectModelo(found);
    else setModeloId(id);
  }

  function selectModelo(modelo: Modelo, list = modelos) {
    setModeloId(modelo.id);
    setCustom(customFromModel(modelo));
    const total = list.length || modelos.length;
    setMsg(`Template selecionado: ${modelo.nome}. Regras da fabrica aplicadas. ${total} templates na biblioteca.`);
  }

  async function ensureLoja() {
    if (lojaId) return lojaId;
    const slug = slugify(lojaName);
    const { data: existing } = await supabase.from('mobil_lojas').select('id,name,slug,status').eq('slug', slug).maybeSingle();
    if (existing) {
      const loja = existing as Loja;
      localStorage.setItem('mobil-loja-id', loja.id);
      localStorage.setItem('mobil-loja-name', loja.name);
      setLojaId(loja.id);
      setLojaName(loja.name);
      return loja.id;
    }
    const { data, error } = await supabase.from('mobil_lojas').insert({ name: lojaName, slug, status: 'active' }).select('id,name').single();
    if (error) throw error;
    localStorage.setItem('mobil-loja-id', data.id);
    localStorage.setItem('mobil-loja-name', data.name);
    setLojaId(data.id);
    return data.id as string;
  }

  async function importFactory(nextFactoryId: string) {
    setFactoryId(nextFactoryId);
    localStorage.setItem('mobil-active-factory', nextFactoryId);
    const factory = factories.find((item) => item.id === nextFactoryId);
    setMsg(factory ? `Loja trabalhando com biblioteca da fabrica ${factory.name}.` : 'Fabrica importada.');

    try {
      const currentLojaId = await ensureLoja();
      const { error } = await supabase.from('mobil_imports_loja').insert({ loja_id: currentLojaId, factory_id: nextFactoryId, active: true });
      if (error) throw error;
      setMsg(factory ? `Importacao registrada: ${factory.name}.` : 'Importacao registrada.');
    } catch (error: any) {
      setMsg(`Biblioteca ativa localmente. Registro no banco nao foi aceito agora: ${error?.message || 'erro'}`);
    }
  }

  const activeFactory = factories.find((item) => item.id === factoryId) || null;
  const activeModel = modelos.find((item) => item.id === modeloId) || null;
  const rules = activeModel?.edicoes_permitidas || {};
  const canEdit = (key: string) => rules[key] !== false;
  const factoryCost = Number(activeModel?.parametros_padrao?.custo || 0);
  const factoryMargin = Number(activeModel?.parametros_padrao?.margem || 45);
  const factoryBasePrice = factoryCost > 0 ? factoryCost / (1 - factoryMargin / 100) : 0;
  const storePrice = factoryBasePrice > 0 ? factoryBasePrice / (1 - custom.margemLoja / 100) : 0;

  return (
    <main className="splitApp storeMode">
      <aside className="splitSide">
        <div className="splitBrand"><span>MOBIL Loja</span><h1>Configurador 3D da loja</h1><p>Escolha uma fabrica, importe a biblioteca dela e adapte apenas o que a fabrica liberou.</p></div>
        <div className="splitBlock"><h2>Loja</h2><label>Nome da loja<input value={lojaName} onChange={(e) => setLojaName(e.target.value)} /></label><button className="splitButton" onClick={ensureLoja}>Ativar loja</button></div>
        <div className="splitBlock"><h2>Escolher fabrica</h2><label>Fabrica parceira<select value={factoryId} onChange={(e) => importFactory(e.target.value)}><option value="">Selecione</option>{factories.map((factory) => <option value={factory.id} key={factory.id}>{factory.name}</option>)}</select></label><p>{activeFactory ? `Biblioteca ativa: ${activeFactory.name}` : 'Nenhuma fabrica escolhida.'}</p></div>
        <div className="splitBlock"><h2>Template importado</h2><label>Template<select value={modeloId} onChange={(e) => selectModeloById(e.target.value)}><option value="">Selecione</option>{modelos.map((modelo) => <option value={modelo.id} key={modelo.id}>{modelo.nome}</option>)}</select></label><LockedField label="Largura" disabled={!canEdit('largura')} value={custom.w} onChange={(v) => setCustom({ ...custom, w: v })} /><LockedField label="Altura" disabled={!canEdit('altura')} value={custom.h} onChange={(v) => setCustom({ ...custom, h: v })} /><LockedField label="Profundidade" disabled={!canEdit('profundidade')} value={custom.d} onChange={(v) => setCustom({ ...custom, d: v })} /><LockedField label="Portas" disabled={!canEdit('portas')} value={custom.portas} onChange={(v) => setCustom({ ...custom, portas: v })} /><LockedField label="Prateleiras" disabled={!canEdit('prateleiras')} value={custom.prateleiras} onChange={(v) => setCustom({ ...custom, prateleiras: v })} /><label className={!canEdit('vidro') ? 'lockedInput' : ''}>Vidro<select disabled={!canEdit('vidro')} value={custom.vidro} onChange={(e) => setCustom({ ...custom, vidro: e.target.value })}><option value="reflecta_bronze">Reflecta bronze</option><option value="reflecta_prata">Reflecta prata</option><option value="espelho_prata">Espelho prata</option><option value="incolor">Incolor</option><option value="fume">Fume</option></select></label><label className={!canEdit('acabamento') ? 'lockedInput' : ''}>Acabamento<select disabled={!canEdit('acabamento')} value={custom.acabamento} onChange={(e) => setCustom({ ...custom, acabamento: e.target.value })}><option value="preto_fosco">Preto fosco</option><option value="preto_brilho">Preto brilho</option><option value="bronze">Bronze</option><option value="dourado">Dourado</option><option value="inox">Inox</option></select></label><label>Margem da loja %<input type="number" value={custom.margemLoja} onChange={(e) => setCustom({ ...custom, margemLoja: Number(e.target.value) })} /></label><p className="builderHint">Campos bloqueados foram travados pela fabrica no template.</p></div>
      </aside>
      <section className="splitMain"><div className="splitTop"><div><span>Modo loja</span><b>Projeto em cima da biblioteca da fabrica</b><small>A loja adapta medidas e preco comercial; a regra tecnica vem da fabrica.</small></div><a className="splitGhost" href="fabrica.html">Abrir MOBIL Fabrica</a></div><ConfiguratorScene title={activeModel?.nome || 'Template da fabrica'} module={{ w: custom.w, h: custom.h, d: custom.d }} color="#805b38" /></section>
      <aside className="splitResult"><div className="splitBrand"><span>Resumo comercial</span><h1>{activeModel?.nome || 'Sem template'}</h1><p>{msg}</p></div><div className="metric"><span>Loja</span><b>{lojaName}</b></div><div className="metric"><span>Fabrica</span><b>{activeFactory?.name || '—'}</b></div><div className="metric"><span>Preco base fabrica</span><b>{factoryBasePrice ? `R$ ${factoryBasePrice.toFixed(2)}` : '—'}</b></div><div className="metric"><span>Preco loja sugerido</span><b>{storePrice ? `R$ ${storePrice.toFixed(2)}` : '—'}</b></div><div className="splitBlock"><h2>Templates importados</h2>{modelos.length === 0 ? <p>Nenhum template importado ainda.</p> : modelos.map((item) => <button className="listItem listButton" key={item.id} onClick={() => selectModelo(item)}><b>{item.nome}</b><small>{item.categoria}</small></button>)}</div></aside>
    </main>
  );
}

function LockedField({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (v: number) => void }) {
  return <label className={disabled ? 'lockedInput' : ''}>{label}<input disabled={disabled} type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}

createRoot(document.getElementById('root') as HTMLElement).render(<LojaApp />);
