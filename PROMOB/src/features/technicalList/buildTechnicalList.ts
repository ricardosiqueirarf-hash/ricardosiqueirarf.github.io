export type TechnicalLine={
  grupo:'perfis'|'vidros'|'mdf'|'acessorios'|'mao_obra'|'bancada'|'outros';
  codigo:string;
  nome:string;
  objeto:string;
  qtd:number;
  unidade:string;
  medida:string;
  custoUnit:number;
  custoTotal:number;
  found:boolean;
};

export type TechnicalSummary={
  lines:TechnicalLine[];
  groups:Record<string,number>;
  totalCost:number;
  suggestedPrice:number;
  warnings:string[];
};

function n(v:any,fallback=0){const out=Number(v);return Number.isFinite(out)?out:fallback}
function brl(v:number){return `R$ ${v.toFixed(2)}`}
function norm(s:any){return String(s||'').toLowerCase()}
function findProfileCost(profiles:any[],code:string){const p=(profiles||[]).find(x=>norm(x.nome).includes(norm(code)));return p?.custo==null?null:n(p.custo)}
function findMaterialCost(materials:any[],terms:string[]){const m=(materials||[]).find(x=>terms.some(t=>norm(x.nome).includes(norm(t))));return m?.custo==null?null:n(m.custo)}
function catalogCost(catalog:any[],profiles:any[],materials:any[],codigo:string){const item=(catalog||[]).find(i=>norm(i.codigo)===norm(codigo));const fromProfile=findProfileCost(profiles,codigo);const terms=[codigo,...(item?.color_search_terms||[])];const fromMaterial=findMaterialCost(materials,terms);const cost=fromProfile??fromMaterial??n(item?.custo_fallback);const found=fromProfile!=null||fromMaterial!=null||n(item?.custo_fallback)>0;return{nome:item?.nome||codigo,unidade:item?.unidade||(/P$/.test(codigo)?'un':'m'),cost,found}}
function add(lines:TechnicalLine[],line:TechnicalLine){if(!line.qtd||line.qtd<0)return;lines.push(line)}
function getParam(rows:any[],key:string,fallback=0){const row=(rows||[]).find(r=>r.chave===key);return n(row?.valor_num,fallback)}
function getBool(rows:any[],key:string,fallback=false){const row=(rows||[]).find(r=>r.chave===key);return row?.valor_bool==null?fallback:Boolean(row.valor_bool)}
function glassName(key:string){return ({incolor:'Vidro incolor',espelho_prata:'Espelho prata',reflecta_bronze:'Reflecta bronze',reflecta_prata:'Reflecta prata',fume:'Vidro fumê'} as Record<string,string>)[key]||key}
const glassCost:Record<string,number>={incolor:120,espelho_prata:180,reflecta_bronze:230,reflecta_prata:220,fume:170};

function addCloset(lines:TechnicalLine[],obj:any,catalog:any[],profiles:any[],materials:any[]){const d=obj.data;const w=n(d.w)/1000,dep=n(d.d)/1000,h=n(d.h)/1000,modules=Math.max(1,n(d.modules,1)),mw=w/modules;const lateral=String(d.sideType||'').includes('9571')?'9571':'9577';const raw:[string,number,string,string][]=[
  ['9566',2*(w+2*dep),'base/topo traseiro e laterais','perfis'],
  ['9567',2*w,'frontal base/topo','perfis'],
  [lateral,2*h,'laterais','perfis'],
  ['9572',Math.max(0,modules-1)*h,'módulos centrais','perfis'],
  ['9573',2*modules*mw+(d.backGlass?w:0),'travessas/prateleiras/fundo','perfis'],
  ['BA11',(d.backGlass?w*2+h*2:0)+(d.doors?2*(w+h):0),'baguete vidro 4mm','acessorios'],
  ['95P',Math.max(0,(modules+1)*2),'conectores módulos','acessorios'],
  ['115P',Math.max(0,(modules+1)*2),'conectores fundo','acessorios'],
  ['120P',4,'fixação base/topo','acessorios']
];
  raw.forEach(([codigo,qtd,medida,grupo])=>{const c=catalogCost(catalog,profiles,materials,codigo);add(lines,{grupo:grupo as any,codigo,nome:c.nome,objeto:obj.name,qtd,unidade:c.unidade,medida,custoUnit:c.cost,custoTotal:qtd*c.cost,found:c.found})});
  if(d.backGlass)add(lines,{grupo:'vidros',codigo:'VIDRO_4MM_FUNDO',nome:'Vidro fundo closet 4mm',objeto:obj.name,qtd:w*h,unidade:'m²',medida:`${Math.round(n(d.w))} x ${Math.round(n(d.h))}`,custoUnit:glassCost.reflecta_bronze,custoTotal:w*h*glassCost.reflecta_bronze,found:true});
  if(d.doors)add(lines,{grupo:'vidros',codigo:'VIDRO_4MM_PORTAS',nome:'Portas de vidro closet 4mm',objeto:obj.name,qtd:w*h,unidade:'m²',medida:`${Math.round(n(d.w))} x ${Math.round(n(d.h))}`,custoUnit:glassCost.reflecta_bronze,custoTotal:w*h*glassCost.reflecta_bronze,found:true});
  if(d.led){const c=catalogCost(catalog,profiles,materials,'DIFUSOR_02R');add(lines,{grupo:'acessorios',codigo:'DIFUSOR_02R',nome:c.nome,objeto:obj.name,qtd:w,unidade:'m',medida:'LED superior por módulo',custoUnit:c.cost,custoTotal:w*c.cost,found:c.found})}
}

function addCristaleira(lines:TechnicalLine[],obj:any,rows:any[],profiles:any[],materials:any[]){const d=obj.data;const hinge=d.hinge==='reta'?'reta':'curva';const desconta=getBool(rows,`${hinge}_desconta_mdf`,hinge==='reta');const baseW=n(d.w)-(desconta?n(d.mdf)*2:0);const baseH=n(d.h)-(desconta?n(d.mdf)*2:0);const dw=((baseW-getParam(rows,`${hinge}_desconto_largura`,0))/Math.max(1,n(d.doors,1)))-(n(d.doors)>1?getParam(rows,`${hinge}_desconto_por_porta`,1.5):0);const dh=baseH-getParam(rows,`${hinge}_desconto_altura`,0);const perda=1+getParam(rows,'porta_perda_percentual',10)/100;const profileName=(profiles||[]).find(p=>p.id===d.profile)?.nome||'Perfil 1036';const profileCost=n((profiles||[]).find(p=>p.id===d.profile)?.custo,19);const ba02Cost=findMaterialCost(materials,['BA02','baguete'])??getParam(rows,'baguete_preco_m',1.2);const cantCost=findMaterialCost(materials,['cantoneira 50','cantoneira'])??getParam(rows,'porta_kit_montagem',4.84);const profileMl=((dw/1000)*2+(dh/1000)*2)*n(d.doors,1)*perda;const glassM2=(dw/1000)*(dh/1000)*n(d.doors,1)*perda;const mdfM2=(n(d.h)/1000*n(d.d)/1000*2)+(n(d.w)/1000*n(d.d)/1000*2)+((n(d.w)-n(d.mdf)*2)/1000*(n(d.d)-n(d.mdf))/1000*n(d.shelves));
  add(lines,{grupo:'perfis',codigo:'1036',nome:profileName,objeto:obj.name,qtd:profileMl,unidade:'m',medida:'quadro das portas',custoUnit:profileCost,custoTotal:profileMl*profileCost,found:profileCost>0});
  add(lines,{grupo:'vidros',codigo:d.glass,nome:glassName(d.glass),objeto:obj.name,qtd:glassM2,unidade:'m²',medida:`${dh.toFixed(0)} x ${dw.toFixed(0)} por porta`,custoUnit:glassCost[d.glass]||0,custoTotal:glassM2*(glassCost[d.glass]||0),found:Boolean(glassCost[d.glass])});
  add(lines,{grupo:'mdf',codigo:'MDF',nome:`MDF ${d.mdf}mm`,objeto:obj.name,qtd:mdfM2,unidade:'m²',medida:'caixa e prateleiras',custoUnit:getParam(rows,'mdf_preco_m2',115),custoTotal:mdfM2*getParam(rows,'mdf_preco_m2',115),found:true});
  add(lines,{grupo:'acessorios',codigo:'BA02',nome:'Baguete BA02',objeto:obj.name,qtd:profileMl,unidade:'m',medida:'portas',custoUnit:ba02Cost,custoTotal:profileMl*ba02Cost,found:ba02Cost>0});
  add(lines,{grupo:'acessorios',codigo:'CANTONEIRA_50',nome:'Cantoneira 50',objeto:obj.name,qtd:n(d.doors,1)*4,unidade:'un',medida:'4 por porta',custoUnit:cantCost,custoTotal:n(d.doors,1)*4*cantCost,found:cantCost>0});
  add(lines,{grupo:'mao_obra',codigo:'MAO_OBRA_PORTA',nome:'Mão de obra portas',objeto:obj.name,qtd:n(d.doors,1),unidade:'un',medida:'por porta',custoUnit:getParam(rows,'porta_mao_obra',35),custoTotal:n(d.doors,1)*getParam(rows,'porta_mao_obra',35),found:true});
}

function addCounter(lines:TechnicalLine[],obj:any){const d=obj.data;const area=n(d.w)*n(d.d)/1000000;add(lines,{grupo:'bancada',codigo:'PEDRA_BANCADA',nome:'Pedra bancada',objeto:obj.name,qtd:area,unidade:'m²',medida:`${d.w} x ${d.d} x ${d.thick}`,custoUnit:0,custoTotal:0,found:false});if(d.sink)add(lines,{grupo:'acessorios',codigo:'CUBA',nome:'Cuba',objeto:obj.name,qtd:1,unidade:'un',medida:'centralizada na área molhada',custoUnit:0,custoTotal:0,found:false});if(d.faucet)add(lines,{grupo:'acessorios',codigo:'TORNEIRA',nome:'Torneira / misturador',objeto:obj.name,qtd:1,unidade:'un',medida:'bancada',custoUnit:0,custoTotal:0,found:false})}
function addWindow(lines:TechnicalLine[],obj:any){const d=obj.data;if(d.glass)add(lines,{grupo:'vidros',codigo:'VIDRO_JANELA',nome:'Vidro janela',objeto:obj.name,qtd:n(d.w)*n(d.h)/1000000,unidade:'m²',medida:`${d.w} x ${d.h}`,custoUnit:glassCost.incolor,custoTotal:n(d.w)*n(d.h)/1000000*glassCost.incolor,found:true});if(d.frame)add(lines,{grupo:'perfis',codigo:'MOLDURA_JANELA',nome:'Moldura janela',objeto:obj.name,qtd:2*(n(d.w)+n(d.h))/1000,unidade:'m',medida:'perímetro',custoUnit:0,custoTotal:0,found:false})}

export function buildTechnicalList(args:{objects:any[];rows:any[];catalog:any[];profiles:any[];materials:any[];margin?:number}):TechnicalSummary{
  const lines:TechnicalLine[]=[];
  (args.objects||[]).forEach(obj=>{if(!obj?.visible)return;if(obj.type==='closet')addCloset(lines,obj,args.catalog,args.profiles,args.materials);if(obj.type==='cristaleira')addCristaleira(lines,obj,args.rows,args.profiles,args.materials);if(obj.type==='countertop')addCounter(lines,obj);if(obj.type==='window')addWindow(lines,obj)});
  const groups=lines.reduce((acc,line)=>{acc[line.grupo]=(acc[line.grupo]||0)+line.custoTotal;return acc},{} as Record<string,number>);
  const totalCost=lines.reduce((s,l)=>s+l.custoTotal,0);
  const margin=n(args.margin,45);
  const suggestedPrice=margin>=100?totalCost:totalCost/(1-margin/100);
  const warnings=lines.filter(l=>!l.found).map(l=>`${l.codigo} sem custo cadastrado (${l.objeto})`);
  return{lines,groups,totalCost,suggestedPrice,warnings};
}

export function formatTechnicalList(summary:TechnicalSummary){
  const byGroup=summary.lines.reduce((acc,line)=>{(acc[line.grupo] ||= []).push(line);return acc},{} as Record<string,TechnicalLine[]>);
  const out:string[]=['LISTA TÉCNICA MOBIL'];
  Object.entries(byGroup).forEach(([g,lines])=>{out.push('',g.toUpperCase());lines.forEach(l=>out.push(`${l.codigo} - ${l.nome} | ${l.qtd.toFixed(l.unidade==='un'?0:2)} ${l.unidade} | ${l.medida} | ${brl(l.custoTotal)}${l.found?'':' | SEM CUSTO'}`))});
  out.push('',`CUSTO TOTAL: ${brl(summary.totalCost)}`,`VENDA SUGERIDA: ${brl(summary.suggestedPrice)}`);
  if(summary.warnings.length)out.push('',...summary.warnings.map(w=>`⚠ ${w}`));
  return out.join('\n');
}
