import React from 'react';
import type { ProjectTemplate, TemplateCategory } from './templateTypes';

const categories:Array<'todos'|TemplateCategory>=['todos','ambiente','closet','cristaleira','adega','bancada','porta','divisoria'];

type Props={
  templates:ProjectTemplate[];
  onAdd:(template:ProjectTemplate)=>void;
  onReplace:(template:ProjectTemplate)=>void;
};

export function TemplatePanel({templates,onAdd,onReplace}:Props){
  const[cat,setCat]=React.useState<'todos'|TemplateCategory>('todos');
  const filtered=cat==='todos'?templates:templates.filter(t=>t.category===cat);
  return <div className="templatePanel">
    <div className="templateTabs">
      {categories.map(c=><button key={c} className={cat===c?'miniBtn active':'miniBtn'} onClick={()=>setCat(c)}>{c}</button>)}
    </div>
    {filtered.map(t=><div className="templateCard" key={t.id}>
      <div className="templateTop"><b>{t.name}</b><span>{t.category}</span></div>
      <p>{t.description}</p>
      <div className="templateTags">{t.tags.slice(0,5).map(tag=><small key={tag}>{tag}</small>)}</div>
      <div className="templateObjects"><span>{t.objects.length} objeto(s)</span>{t.defaultEnvironment&&<span>ambiente pronto</span>}</div>
      <div className="templateActions"><button className="miniBtn" onClick={()=>onAdd(t)}>Adicionar</button>{t.defaultEnvironment&&<button className="miniBtn" onClick={()=>onReplace(t)}>Substituir ambiente</button>}</div>
      {t.technicalNotes.length>0&&<details><summary>Notas técnicas</summary>{t.technicalNotes.map(note=><small key={note}>{note}</small>)}</details>}
    </div>)}
  </div>;
}
