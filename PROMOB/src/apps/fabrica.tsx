import React from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { ConfiguratorScene } from './shared3d';
import { TemplateBuilder, templateInicial, type TemplateDraft } from './TemplateBuilder';
import './split.css';

const MOBIL_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://uyssmueddxtylajnmxad.supabase.co';
const MOBIL_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_YVwgZbFAqi5M4N1i-Iwgdg_7GTzwxrw';
const supabase = createClient(MOBIL_URL, MOBIL_KEY);

type ModeloDb = { id: string; nome: string; categoria: string; parametros_padrao: any; edicoes_permitidas?: any };

type ModeloSalvo = TemplateDraft & { id?: string };

function slugify(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `fabrica-${Date.now()}`;
}

function fromDb(item: ModeloDb): ModeloSalvo {
  const p = item.parametros_padrao || {};
  const e = item.edicoes_permitidas || {};
  return {
    ...templateInicial,
    id: item.id,
    nome: item.nome,
    categoria: item.categoria,
    descricao: p.descricao || templateInicial.descricao,
    largura: Number(p.largura || 1000),
    altura: Number(p.altura || 2200),
    profundidade: Number(p.profundidade || 450),
    mdf: Number(p.mdf || 18),
    portas: Number(p.portas || 2),
    prateleiras: Number(p.prateleiras || 4),
    perfil: p.perfil || '1036',
    vidro: p.vidro || 'reflecta_bronze',
    acabamento: p.acabamento || 'preto_fosco',
    custo: Number(p.custo || 0),
    margem: Number(p.margem || 45),
    perda: Number(p.perda || 10),
    maoObra: Number(p.maoObra || 120),
    lojaEdita: {
      largura: e.largura !== false,
      altura: e.altura !== false,
      profundidade: e.profundidade !== false,
      vidro: e.vidro !== false,
      acabamento: e.acabamento !== false,
      portas: e.portas !== false,
      prateleiras: e.prateleiras !== false,
    },
  };
}

function FabricaApp() {
  const [factoryName, setFactoryName] = React.useState(localStorage.getItem('mobil-factory-name') || 'Minha fabrica');
  const [factoryId, setFactoryId] = React.useState(localStorage.getItem('mobil-factory-id') || '');
  const [draft, setDraft] = React.useState<TemplateDraft>(templateInicial);
  const [modelos, setModelos] = React.useState<ModeloSalvo[]>([]);
  const [msg, setMsg] = React.useState('Crie templates parametricos para as lojas importarem.');

  React.useEffect(() => {
    if (!factoryId) return;
    carregarModelos(factoryId);
  }, [factoryId]);

  async function carregarModelos(id: string) {
    const { data, error } = await supabase.from('mobil_modelos_factory').select('id,nome,categoria,parametros_padrao,edicoes_permitidas').eq('factory_id', id).eq('ativo', true).order('nome');
    if (error) {
      setMsg('Fabrica ativada, mas nao consegui carregar templates salvos.');
      return;
    }
    const loaded = ((data || []) as ModeloDb[]).map(fromDb);
    setModelos(loaded);
    if (loaded[0]) setDraft(loaded[0]);
    setMsg(`Biblioteca carregada: ${loaded.length} templates.`);
  }

  async function ensureFactory() {
    if (factoryId) {
      await carregarModelos(factoryId);
      return factoryId;
    }
    const slug = slugify(factoryName);
    const { data: existing } = await supabase.from('mobil_factories').select('id,name').eq('slug', slug).maybeSingle();
    if (existing) {
      localStorage.setItem('mobil-factory-id', existing.id);
      localStorage.setItem('mobil-factory-name', existing.name);
      setFactoryId(existing.id);
      setFactoryName(existing.name);
      await carregarModelos(existing.id);
      return existing.id as string;
    }
    const { data, error } = await supabase.from('mobil_factories').insert({ name: factoryName, slug, status: 'active' }).select('id,name').single();
    if (error) throw error;
    localStorage.setItem('mobil-factory-id', data.id);
    localStorage.setItem('mobil-factory-name', data.name);
    setFactoryId(data.id);
    return data.id as string;
  }

  async function publicarTemplate() {
    try {
      const id = await ensureFactory();
      const payload = {
        factory_id: id,
        nome: draft.nome,
        categoria: draft.categoria,
        objetos: [{ type: draft.categoria, w: draft.largura, h: draft.altura, d: draft.profundidade }],
        parametros_padrao: {
          descricao: draft.descricao,
          largura: draft.largura,
          altura: draft.altura,
          profundidade: draft.profundidade,
          mdf: draft.mdf,
          portas: draft.portas,
          prateleiras: draft.prateleiras,
          perfil: draft.perfil,
          vidro: draft.vidro,
          acabamento: draft.acabamento,
          custo: draft.custo,
          margem: draft.margem,
          perda: draft.perda,
          maoObra: draft.maoObra,
        },
        edicoes_permitidas: draft.lojaEdita,
        status: 'publicado',
        ativo: true,
      };
      const { data, error } = await supabase.from('mobil_modelos_factory').insert(payload).select('id,nome,categoria,parametros_padrao,edicoes_permitidas').single();
      if (error) throw error;
      const saved = fromDb(data as ModeloDb);
      setModelos((items) => [saved, ...items]);
      setDraft(saved);
      setMsg('Template publicado. A loja ja pode importar com as regras de edicao.');
    } catch (error: any) {
      setModelos((items) => [{ ...draft, id: `local-${Date.now()}` }, ...items]);
      setMsg(`Template salvo localmente. Supabase nao aceitou agora: ${error?.message || 'erro'}`);
    }
  }

  const custoFinal = draft.custo * (1 + draft.perda / 100) + draft.maoObra;
  const preco = custoFinal / (1 - draft.margem / 100);

  return (
    <main className="splitApp factoryMode">
      <aside className="splitSide">
        <div className="splitBrand"><span>MOBIL Fabrica</span><h1>Criador de Template 3D</h1><p>A fabrica configura. O MOBIL gera o 3D. A loja adapta dentro das regras.</p></div>
        <div className="splitBlock"><h2>Identidade da fabrica</h2><label>Nome da fabrica<input value={factoryName} onChange={(e) => setFactoryName(e.target.value)} /></label><button className="splitButton" onClick={ensureFactory}>Ativar / carregar fabrica</button><button className="splitGhost" onClick={() => setDraft({ ...templateInicial, nome: `Novo template ${modelos.length + 1}` })}>Novo template</button></div>
        <TemplateBuilder draft={draft} setDraft={setDraft} onPublish={publicarTemplate} />
      </aside>
      <section className="splitMain"><div className="splitTop"><div><span>Modo fabrica</span><b>Template parametrico guiado</b><small>Produto nasce aqui com medidas, componentes, custo e regras.</small></div><a className="splitGhost" href="loja.html">Abrir MOBIL Loja</a></div><ConfiguratorScene title={draft.nome} module={{ w: draft.largura, h: draft.altura, d: draft.profundidade }} color="#6f4b2d" showFactoryGuides /></section>
      <aside className="splitResult"><div className="splitBrand"><span>Resumo tecnico</span><h1>{draft.nome}</h1><p>{msg}</p></div><div className="metric"><span>Fabrica ativa</span><b>{factoryId ? factoryName : '—'}</b></div><div className="metric"><span>Custo com perda + mao de obra</span><b>R$ {custoFinal.toFixed(2)}</b></div><div className="metric"><span>Preco base sugerido</span><b>R$ {preco.toFixed(2)}</b></div><div className="metric"><span>Margem minima</span><b>{draft.margem}%</b></div><div className="splitBlock"><h2>Templates publicados</h2>{modelos.length === 0 ? <p>Nenhum template publicado ainda.</p> : modelos.map((item) => <button className="listItem listButton" key={item.id} onClick={() => setDraft(item)}><b>{item.nome}</b><small>{item.largura} x {item.altura} x {item.profundidade} mm · {item.perfil} · {item.vidro}</small></button>)}</div></aside>
    </main>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<FabricaApp />);
