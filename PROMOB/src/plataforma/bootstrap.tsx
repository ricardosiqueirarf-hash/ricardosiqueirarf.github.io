import React from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './portal.css';

const MOBIL_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://uyssmueddxtylajnmxad.supabase.co';
const MOBIL_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_YVwgZbFAqi5M4N1i-Iwgdg_7GTzwxrw';
const supabase = createClient(MOBIL_URL, MOBIL_KEY);

type Factory = { id: string; name: string; slug: string; status: string };
type ImportedFactory = { id: string; factory_id: string; active: boolean };

function MobilPortal() {
  const [open, setOpen] = React.useState(false);
  const [factories, setFactories] = React.useState<Factory[]>([]);
  const [selectedFactoryId, setSelectedFactoryId] = React.useState<string>(() => localStorage.getItem('mobil-active-factory') || '');
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    supabase.from('mobil_factories').select('id,name,slug,status').eq('status', 'active').order('name').then(({ data, error }) => {
      if (error) {
        setMessage('Não consegui carregar fábricas do MOBIL.');
        return;
      }
      setFactories((data || []) as Factory[]);
    });
  }, []);

  const selectedFactory = factories.find((factory) => factory.id === selectedFactoryId) || null;

  function importFactory(factoryId: string) {
    localStorage.setItem('mobil-active-factory', factoryId);
    setSelectedFactoryId(factoryId);
    const factory = factories.find((item) => item.id === factoryId);
    setMessage(factory ? `Biblioteca importada: ${factory.name}` : 'Biblioteca importada.');
  }

  return (
    <>
      <button className="mobilPortalButton" onClick={() => setOpen(!open)}>
        Plataforma MOBIL
      </button>

      {open && (
        <div className="mobilPortalPanel">
          <div className="mobilPortalHeader">
            <span>Fábrica ↔ Loja</span>
            <button onClick={() => setOpen(false)}>×</button>
          </div>

          <div className="mobilPortalHero">
            <h2>Separação MOBIL</h2>
            <p>Fábrica cria biblioteca técnica. Loja escolhe fábrica e projeta usando essa biblioteca.</p>
          </div>

          <div className="mobilPortalGrid">
            <div className="mobilPortalCard factory">
              <span>MOBIL Fábrica</span>
              <h3>Cria biblioteca</h3>
              <p>Produtos, custos, modelos, módulos, templates, parâmetros e regras.</p>
              <small>Tabelas: mobil_factories, mobil_produtos_factory, mobil_modelos_factory</small>
            </div>
            <div className="mobilPortalCard store">
              <span>MOBIL Loja</span>
              <h3>Importa biblioteca</h3>
              <p>Escolhe uma fábrica, importa modelos e adapta o projeto do cliente.</p>
              <small>Tabelas: mobil_lojas, mobil_imports_loja, mobil_parcerias</small>
            </div>
          </div>

          <div className="mobilFactoryPicker">
            <label>
              Fábrica ativa da loja
              <select value={selectedFactoryId} onChange={(event) => importFactory(event.target.value)}>
                <option value="">Selecione uma fábrica</option>
                {factories.map((factory) => (
                  <option key={factory.id} value={factory.id}>{factory.name}</option>
                ))}
              </select>
            </label>
            <div className="mobilPortalStatus">
              {selectedFactory ? `Loja trabalhando com: ${selectedFactory.name}` : 'Nenhuma fábrica importada ainda.'}
            </div>
            {message && <div className="mobilPortalMessage">{message}</div>}
          </div>
        </div>
      )}
    </>
  );
}

const host = document.createElement('div');
host.id = 'mobil-platform-root';
document.body.appendChild(host);
createRoot(host).render(<MobilPortal />);
