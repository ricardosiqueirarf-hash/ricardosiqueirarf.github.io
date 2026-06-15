import React from 'react';

export type TemplateDraft = {
  nome: string;
  categoria: string;
  descricao: string;
  largura: number;
  altura: number;
  profundidade: number;
  mdf: number;
  portas: number;
  prateleiras: number;
  perfil: string;
  vidro: string;
  acabamento: string;
  custo: number;
  margem: number;
  perda: number;
  maoObra: number;
  lojaEdita: {
    largura: boolean;
    altura: boolean;
    profundidade: boolean;
    vidro: boolean;
    acabamento: boolean;
    portas: boolean;
    prateleiras: boolean;
  };
};

export const templateInicial: TemplateDraft = {
  nome: 'Cristaleira 1036 premium',
  categoria: 'cristaleira',
  descricao: 'Modelo parametrico criado pela fabrica.',
  largura: 1000,
  altura: 2200,
  profundidade: 450,
  mdf: 18,
  portas: 2,
  prateleiras: 4,
  perfil: '1036',
  vidro: 'reflecta_bronze',
  acabamento: 'preto_fosco',
  custo: 780,
  margem: 45,
  perda: 10,
  maoObra: 120,
  lojaEdita: {
    largura: true,
    altura: true,
    profundidade: true,
    vidro: true,
    acabamento: true,
    portas: true,
    prateleiras: true,
  },
};

type Step = 'produto' | 'medidas' | 'componentes' | 'regras';

type Props = {
  draft: TemplateDraft;
  setDraft: (draft: TemplateDraft) => void;
  onPublish: () => void;
};

export function TemplateBuilder({ draft, setDraft, onPublish }: Props) {
  const [step, setStep] = React.useState<Step>('produto');

  return (
    <div className="templateBuilder">
      <div className="templateStepNav">
        <StepButton active={step === 'produto'} onClick={() => setStep('produto')} title="01 Produto" subtitle="nome e tipo" />
        <StepButton active={step === 'medidas'} onClick={() => setStep('medidas')} title="02 Medidas" subtitle="dimensoes" />
        <StepButton active={step === 'componentes'} onClick={() => setStep('componentes')} title="03 Componentes" subtitle="custos" />
        <StepButton active={step === 'regras'} onClick={() => setStep('regras')} title="04 Regras" subtitle="loja" />
      </div>

      <div className="splitBlock templateBuilderBlock">
        {step === 'produto' && <ProdutoStep draft={draft} setDraft={setDraft} />}
        {step === 'medidas' && <MedidasStep draft={draft} setDraft={setDraft} />}
        {step === 'componentes' && <ComponentesStep draft={draft} setDraft={setDraft} />}
        {step === 'regras' && <RegrasStep draft={draft} setDraft={setDraft} />}
        <button className="splitButton" onClick={onPublish}>Publicar template para lojas</button>
      </div>
    </div>
  );
}

function StepButton({ active, onClick, title, subtitle }: { active: boolean; onClick: () => void; title: string; subtitle: string }) {
  return <button className={active ? 'active' : ''} onClick={onClick}><b>{title}</b><span>{subtitle}</span></button>;
}

function ProdutoStep({ draft, setDraft }: PropsWithoutPublish) {
  return <><h2>Produto</h2><label>Nome do template<input value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} /></label><label>Tipo<select value={draft.categoria} onChange={(e) => setDraft({ ...draft, categoria: e.target.value })}><option value="cristaleira">Cristaleira</option><option value="closet">Closet</option><option value="adega">Adega</option><option value="bancada">Bancada</option><option value="porta">Porta</option><option value="modulo_mdf">Modulo MDF</option></select></label><label>Descricao<input value={draft.descricao} onChange={(e) => setDraft({ ...draft, descricao: e.target.value })} /></label></>;
}

function MedidasStep({ draft, setDraft }: PropsWithoutPublish) {
  return <><h2>Medidas padrao</h2><NumberField label="Largura" value={draft.largura} onChange={(v) => setDraft({ ...draft, largura: v })} /><NumberField label="Altura" value={draft.altura} onChange={(v) => setDraft({ ...draft, altura: v })} /><NumberField label="Profundidade" value={draft.profundidade} onChange={(v) => setDraft({ ...draft, profundidade: v })} /><NumberField label="MDF" value={draft.mdf} onChange={(v) => setDraft({ ...draft, mdf: v })} /><NumberField label="Portas" value={draft.portas} onChange={(v) => setDraft({ ...draft, portas: v })} /><NumberField label="Prateleiras" value={draft.prateleiras} onChange={(v) => setDraft({ ...draft, prateleiras: v })} /></>;
}

function ComponentesStep({ draft, setDraft }: PropsWithoutPublish) {
  return <><h2>Componentes e custos</h2><label>Perfil padrao<input value={draft.perfil} onChange={(e) => setDraft({ ...draft, perfil: e.target.value })} /></label><label>Vidro<select value={draft.vidro} onChange={(e) => setDraft({ ...draft, vidro: e.target.value })}><option value="reflecta_bronze">Reflecta bronze</option><option value="reflecta_prata">Reflecta prata</option><option value="espelho_prata">Espelho prata</option><option value="incolor">Incolor</option><option value="fume">Fume</option></select></label><label>Acabamento<select value={draft.acabamento} onChange={(e) => setDraft({ ...draft, acabamento: e.target.value })}><option value="preto_fosco">Preto fosco</option><option value="preto_brilho">Preto brilho</option><option value="bronze">Bronze</option><option value="dourado">Dourado</option><option value="inox">Inox</option></select></label><NumberField label="Custo base" value={draft.custo} onChange={(v) => setDraft({ ...draft, custo: v })} /><NumberField label="Perda %" value={draft.perda} onChange={(v) => setDraft({ ...draft, perda: v })} /><NumberField label="Mao de obra" value={draft.maoObra} onChange={(v) => setDraft({ ...draft, maoObra: v })} /><NumberField label="Margem minima %" value={draft.margem} onChange={(v) => setDraft({ ...draft, margem: v })} /></>;
}

function RegrasStep({ draft, setDraft }: PropsWithoutPublish) {
  const update = (key: keyof TemplateDraft['lojaEdita'], value: boolean) => setDraft({ ...draft, lojaEdita: { ...draft.lojaEdita, [key]: value } });
  return <><h2>Regras da loja</h2><p className="builderHint">Custo, perda e margem minima ficam travados na fabrica. Marque apenas o que a loja pode alterar.</p><Toggle label="Editar largura" checked={draft.lojaEdita.largura} onChange={(v) => update('largura', v)} /><Toggle label="Editar altura" checked={draft.lojaEdita.altura} onChange={(v) => update('altura', v)} /><Toggle label="Editar profundidade" checked={draft.lojaEdita.profundidade} onChange={(v) => update('profundidade', v)} /><Toggle label="Editar vidro" checked={draft.lojaEdita.vidro} onChange={(v) => update('vidro', v)} /><Toggle label="Editar acabamento" checked={draft.lojaEdita.acabamento} onChange={(v) => update('acabamento', v)} /><Toggle label="Editar portas" checked={draft.lojaEdita.portas} onChange={(v) => update('portas', v)} /><Toggle label="Editar prateleiras" checked={draft.lojaEdita.prateleiras} onChange={(v) => update('prateleiras', v)} /></>;
}

type PropsWithoutPublish = Omit<Props, 'onPublish'>;

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return <label>{label}<input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="checkLabel"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
}
