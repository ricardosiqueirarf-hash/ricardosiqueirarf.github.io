import React from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { ConfiguratorScene } from './shared3d';
import { TemplateBuilder, templateInicial, type TemplateDraft } from './TemplateBuilder';
import { FreeTemplateBuilder, FreeTemplateScene, freePiecesInicial, type FreePiece } from './FreeTemplateBuilder';
import './split.css';

const MOBIL_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://uyssmueddxtylajnmxad.supabase.co';
const MOBIL_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_YVwgZbFAqi5M4N1i-Iwgdg_7GTzwxrw';
const supabase = createClient(MOBIL_URL, MOBIL_KEY);

type CreationMode = 'guiado' | 'livre';
type ModeloDb = { id: string; nome: string; categoria: string; parametros_padrao: any; edicoes_permitidas?: any; objetos?: any[] };
type ModeloSalvo = TemplateDraft & { id?: string; objetosLivres?: FreePiece[]; modo?: CreationMode };

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
    modo: p.modo_criacao === 'livre' ? 'livre' : 'guiado',
    objetosLivres: Array.isArray(item.objetos) ? item.objetos as FreePiece[] : [],
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

function boundsFromPieces(pieces: FreePiece[]) {
  if (!pieces.length) return { largura: 1000, altura: 2200, profundidade: 450 };
  const minX = Math.min(...pieces.map((p) => p.x - p.w / 2));
  const maxX = Math.max(...pieces.map((p) => p.x + p.w / 2));
  const minY = Math.min(...pieces.map((p) => p.y - p.h / 2));
  const maxY = Math.max(...pieces.map((p) => p.y + p.h / 2));
  const minZ = Math.min(...pieces.map((p) => p.z - p.d / 2));
  const maxZ = Math.max(...pieces.map((p) => p.z + p.d / 2));
  return { largura: Math.round(maxX - minX), altura: Math.round(maxY - minY), profundidade: Math.round(maxZ - minZ) };
}

function FabricaApp() {
  const [factoryName, setFactoryName] = React.useState(localStorage.getItem('mobil-factory-name') || 'Minha fabrica');
  const [factoryId, setFactoryId] = React.useState(localStorage.getItem('mobil-factory-id') || '');
  const [draft, setDraft] = React.useState<TemplateDraft>(templateInicial);
  const [creationMode, setCreationMode] = React.useState<CreationMode>('livre');
  const [freePieces, setFreePieces] = React.useState<FreePiece[]>(freePiecesInicial);
  const [modelos, setModelos] = React.useState<ModeloSalvo[]>([]);
  const [msg, setMsg] = React.useState('Crie o template livre primeiro. Depois parametrize e publique para a loja.');

  React.useEffect(() => {
    if (!factoryId) return;
    carregarModelos(factoryId);
  }, [factoryId]);

  async function carregarModelos(id: string) {
    const { data, error } = await supabase.from('mobil_modelos_factory').select('id,nome,categoria,objetos,parametros_padrao,edicoes_permitidas').eq('factory_id', id).eq('ativo', true).order('nome');
    if (error) {
      setMsg('Fabrica ativada, mas nao consegui carregar templates salvos.');
      return;
    }
    const loaded = ((data || []) as ModeloDb[]).map(fromDb);
    setModelos(loaded);
    if (loaded[0]) carregarTemplate(loaded[0]);
    setMsg(`Biblioteca carregada: ${loaded.length} templates.`);
  }

  function carregarTemplate(item: ModeloSalvo) {
    setDraft(item);
    setCreationMode(item.modo || 'guiado');
    if (item.objetosLivres?.length) setFreePieces(item.objetosLivres);
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
      const medidasLivres = boundsFromPieces(freePieces);
      const medidas = creationMode === 'livre' ? medidasLivres : { largura: draft.largura, altura: draft.altura, profundidade: draft.profundidade };
      const objetos = creationMode === 'livre'
        ? freePieces.map((piece) => ({ ...piece, source: 'free_builder' }))
        : [{ type: draft.categoria, w: draft.largura, h: draft.altura, d: draft.profundidade }];
      const payload = {
        factory_id: id,
        nome: draft.nome,
        categoria: draft.categoria,
        objetos,
        parametros_padrao: {
          descricao: draft.descricao,
          largura: medidas.largura,
          altura: medidas.altura,
          profundidade: medidas.profundidade,
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
          modo_criacao: creationMode,
        },
        edicoes_permitidas: draft.lojaEdita,
        status: 'publicado',
        ativo: true,
      };
      const { data, error } = await supabase.from('mobil_modelos_factory').insert(payload).select('id,nome,categoria,objetos,parametros_padrao,edicoes_permitidas').single();
      if (error) throw error;
      const saved = fromDb(data as ModeloDb);
      setModelos((items) => [saved, ...items]);
      carregarTemplate(saved);
      setMsg(creationMode === 'livre' ? 'Template livre publicado. Agora ele pode ser parametrizado e importado pela loja.' : 'Template guiado publicado.');
    } catch (error: any) {
      setModelos((items) => [{ ...draft, id: `local-${Date.now()}`, modo: creationMode, objetosLivres: freePieces }, ...items]);
      setMsg(`Template salvo localmente. Supabase nao aceitou agora: ${error?.message || 'erro'}`);
    }
  }

  function novoTemplate() {
    setDraft({ ...templateInicial, nome: `Novo template ${modelos.length + 1}` });
    setFreePieces(freePiecesInicial);
    setCreationMode('livre');
    setMsg('Novo template livre iniciado. Adicione peças, ajuste medidas e depois publique.');
  }

  const custoFinal = draft.custo * (1 + draft.perda / 100) + draft.maoObra;
  const preco = custoFinal / (1 - draft.margem / 100);

  return (
    <main className="splitApp factoryMode">
      <aside className="splitSide">
        <div className="splitBrand"><span>MOBIL Fabrica</span><h1>Criador de Template 3D</h1><p>Crie livre como SketchUp simples. Depois aplique parâmetros, custos e regras.</p></div>
        <div className="splitBlock"><h2>Identidade da fabrica</h2><label>Nome da fabrica<input value={factoryName} onChange={(e) => setFactoryName(e.target.value)} /></label><button className="splitButton" onClick={ensureFactory}>Ativar / carregar fabrica</button><button className="splitGhost" onClick={novoTemplate}>Novo template livre</button></div>
        <div className="freeModeSwitch"><button className={creationMode === 'livre' ? 'active' : ''} onClick={() => setCreationMode('livre')}>Criador livre</button><button className={creationMode === 'guiado' ? 'active' : ''} onClick={() => setCreationMode('guiado')}>Parametrização guiada</button></div>
        {creationMode === 'livre' ? <FreeTemplateBuilder pieces={freePieces} setPieces={setFreePieces} /> : <TemplateBuilder draft={draft} setDraft={setDraft} onPublish={publicarTemplate} />}
        {creationMode === 'livre' && <div className="splitBlock"><h2>Parametrização básica</h2><label>Nome do template<input value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} /></label><label>Categoria<select value={draft.categoria} onChange={(e) => setDraft({ ...draft, categoria: e.target.value })}><option value="cristaleira">Cristaleira</option><option value="closet">Closet</option><option value="adega">Adega</option><option value="bancada">Bancada</option><option value="porta">Porta</option><option value="modulo_mdf">Modulo MDF</option></select></label><label>Custo base<input type="number" value={draft.custo} onChange={(e) => setDraft({ ...draft, custo: Number(e.target.value) })} /></label><label>Margem mínima %<input type="number" value={draft.margem} onChange={(e) => setDraft({ ...draft, margem: Number(e.target.value) })} /></label><button className="splitButton" onClick={publicarTemplate}>Publicar template livre</button></div>}
      </aside>
      <section className="splitMain"><div className="splitTop"><div><span>Modo fabrica</span><b>{creationMode === 'livre' ? 'Template livre' : 'Template parametrico guiado'}</b><small>{creationMode === 'livre' ? 'Adicione peças, volumes, vidro, MDF e perfis livremente.' : 'Produto nasce com medidas, componentes, custo e regras.'}</small></div><a className="splitGhost" href="loja.html">Abrir MOBIL Loja</a></div>{creationMode === 'livre' ? <FreeTemplateScene pieces={freePieces} /> : <ConfiguratorScene title={draft.nome} module={{ w: draft.largura, h: draft.altura, d: draft.profundidade }} color="#6f4b2d" showFactoryGuides />}</section>
      <aside className="splitResult"><div className="splitBrand"><span>Resumo tecnico</span><h1>{draft.nome}</h1><p>{msg}</p></div><div className="metric"><span>Modo de criação</span><b>{creationMode === 'livre' ? 'Livre' : 'Guiado'}</b></div><div className="metric"><span>Peças livres</span><b>{freePieces.length}</b></div><div className="metric"><span>Custo com perda + mao de obra</span><b>R$ {custoFinal.toFixed(2)}</b></div><div className="metric"><span>Preco base sugerido</span><b>R$ {preco.toFixed(2)}</b></div><div className="splitBlock"><h2>Templates publicados</h2>{modelos.length === 0 ? <p>Nenhum template publicado ainda.</p> : modelos.map((item) => <button className="listItem listButton" key={item.id} onClick={() => carregarTemplate(item)}><b>{item.nome}</b><small>{item.modo === 'livre' ? 'Livre' : 'Guiado'} · {item.largura} x {item.altura} x {item.profundidade} mm</small></button>)}</div></aside>
    </main>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<FabricaApp />);
