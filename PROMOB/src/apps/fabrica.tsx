import React from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { ConfiguratorScene } from './shared3d';
import './split.css';

const MOBIL_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://uyssmueddxtylajnmxad.supabase.co';
const MOBIL_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_YVwgZbFAqi5M4N1i-Iwgdg_7GTzwxrw';
const supabase = createClient(MOBIL_URL, MOBIL_KEY);

type Modelo = { id?: string; nome: string; categoria: string; w: number; h: number; d: number; custo: number; margem: number };

function FabricaApp() {
  const [factoryName, setFactoryName] = React.useState('Minha fábrica');
  const [factoryId, setFactoryId] = React.useState(localStorage.getItem('mobil-factory-id') || '');
  const [modelo, setModelo] = React.useState<Modelo>({ nome: 'Cristaleira 1036 premium', categoria: 'cristaleira', w: 1000, h: 2200, d: 450, custo: 780, margem: 45 });
  const [modelos, setModelos] = React.useState<Modelo[]>([]);
  const [msg, setMsg] = React.useState('Configure a fábrica e publique os modelos para as lojas usarem.');

  async function ensureFactory() {
    if (factoryId) return factoryId;
    const slug = factoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `fabrica-${Date.now()}`;
    const { data, error } = await supabase.from('mobil_factories').insert({ name: factoryName, slug, status: 'active' }).select('id').single();
    if (error) throw error;
    localStorage.setItem('mobil-factory-id', data.id);
    setFactoryId(data.id);
    return data.id as string;
  }

  async function publicarModelo() {
    try {
      const id = await ensureFactory();
      const payload = {
        factory_id: id,
        nome: modelo.nome,
        categoria: modelo.categoria,
        objetos: [{ type: modelo.categoria, w: modelo.w, h: modelo.h, d: modelo.d }],
        parametros_padrao: { largura: modelo.w, altura: modelo.h, profundidade: modelo.d, custo: modelo.custo, margem: modelo.margem },
        ativo: true,
      };
      const { error } = await supabase.from('mobil_modelos_factory').insert(payload);
      if (error) throw error;
      setModelos((items) => [{ ...modelo, id: `${Date.now()}` }, ...items]);
      setMsg('Modelo publicado na biblioteca da fábrica.');
    } catch (error: any) {
      setModelos((items) => [{ ...modelo, id: `local-${Date.now()}` }, ...items]);
      setMsg(`Modelo salvo localmente. Supabase não aceitou agora: ${error?.message || 'erro'}`);
    }
  }

  const preco = modelo.custo / (1 - modelo.margem / 100);

  return (
    <main className="splitApp factoryMode">
      <aside className="splitSide">
        <div className="splitBrand"><span>MOBIL Fábrica</span><h1>Configurador 3D da fábrica</h1><p>Crie móveis, módulos e templates com custo, margem e parâmetros técnicos.</p></div>
        <div className="splitBlock"><h2>Identidade da fábrica</h2><label>Nome da fábrica<input value={factoryName} onChange={(e) => setFactoryName(e.target.value)} /></label><button className="splitButton" onClick={ensureFactory}>Ativar fábrica</button></div>
        <div className="splitBlock"><h2>Novo modelo/template</h2><label>Nome<input value={modelo.nome} onChange={(e) => setModelo({ ...modelo, nome: e.target.value })} /></label><label>Categoria<select value={modelo.categoria} onChange={(e) => setModelo({ ...modelo, categoria: e.target.value })}><option value="cristaleira">Cristaleira</option><option value="closet">Closet</option><option value="adega">Adega</option><option value="bancada">Bancada</option></select></label><label>Largura<input type="number" value={modelo.w} onChange={(e) => setModelo({ ...modelo, w: Number(e.target.value) })} /></label><label>Altura<input type="number" value={modelo.h} onChange={(e) => setModelo({ ...modelo, h: Number(e.target.value) })} /></label><label>Profundidade<input type="number" value={modelo.d} onChange={(e) => setModelo({ ...modelo, d: Number(e.target.value) })} /></label><label>Custo fábrica<input type="number" value={modelo.custo} onChange={(e) => setModelo({ ...modelo, custo: Number(e.target.value) })} /></label><label>Margem mínima %<input type="number" value={modelo.margem} onChange={(e) => setModelo({ ...modelo, margem: Number(e.target.value) })} /></label><button className="splitButton" onClick={publicarModelo}>Publicar modelo para lojas</button></div>
      </aside>
      <section className="splitMain"><div className="splitTop"><div><span>Modo fábrica</span><b>Construção da biblioteca</b><small>Produto nasce aqui com custo, regra e parâmetro.</small></div><a className="splitGhost" href="/loja.html">Abrir MOBIL Loja</a></div><ConfiguratorScene title={modelo.nome} module={{ w: modelo.w, h: modelo.h, d: modelo.d }} color="#6f4b2d" showFactoryGuides /></section>
      <aside className="splitResult"><div className="splitBrand"><span>Resumo técnico</span><h1>{modelo.nome}</h1><p>{msg}</p></div><div className="metric"><span>Custo fábrica</span><b>R$ {modelo.custo.toFixed(2)}</b></div><div className="metric"><span>Preço base sugerido</span><b>R$ {preco.toFixed(2)}</b></div><div className="metric"><span>Margem mínima</span><b>{modelo.margem}%</b></div><div className="splitBlock"><h2>Modelos publicados nesta sessão</h2>{modelos.length === 0 ? <p>Nenhum modelo publicado ainda.</p> : modelos.map((item) => <div className="listItem" key={item.id}><b>{item.nome}</b><small>{item.w} x {item.h} x {item.d} mm · custo R$ {item.custo.toFixed(2)}</small></div>)}</div></aside>
    </main>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<FabricaApp />);
