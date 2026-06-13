export type MdfPart={
  id:string;
  objeto:string;
  nome:string;
  w:number;
  h:number;
  qty:number;
  thickness:number;
  material:string;
  grain:boolean;
  edge?:string;
};

export type PlacedPart=MdfPart&{
  sheet:number;
  x:number;
  y:number;
  rotated:boolean;
  cutW:number;
  cutH:number;
};

export type MdfSheetPlan={
  sheet:number;
  w:number;
  h:number;
  usedArea:number;
  wasteArea:number;
  efficiency:number;
  parts:PlacedPart[];
};

export type MdfCutPlan={
  parts:MdfPart[];
  sheets:MdfSheetPlan[];
  totalArea:number;
  sheetArea:number;
  warnings:string[];
};

type SheetCfg={w:number;h:number;margin:number;spacing:number;kerf:number};
const defaultSheet:SheetCfg={w:2750,h:1850,margin:10,spacing:8,kerf:6};
function n(v:any,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function getParam(rows:any[],key:string,f=0){const r=(rows||[]).find(x=>x.chave===key);return n(r?.valor_num,f)}
function addPart(parts:MdfPart[],p:Omit<MdfPart,'id'>){const qty=Math.max(0,Math.round(n(p.qty,1)));if(!qty||n(p.w)<=0||n(p.h)<=0)return;parts.push({...p,qty,id:`${p.objeto}-${p.nome}-${parts.length}`})}

export function buildMdfParts(objects:any[],rows:any[]):MdfPart[]{
  const parts:MdfPart[]=[];
  (objects||[]).filter(o=>o?.visible!==false).forEach((obj:any)=>{
    if(obj.type==='cristaleira'){
      const d=obj.data;
      const mdf=n(d.mdf,18);
      const w=n(d.w),h=n(d.h),dep=n(d.d);
      const internalW=Math.max(0,w-mdf*2);
      const shelfD=Math.max(0,dep-mdf);
      addPart(parts,{objeto:obj.name,nome:'Lateral esquerda',w:dep,h,qty:1,thickness:mdf,material:`MDF ${mdf}mm`,grain:true,edge:'frente'});
      addPart(parts,{objeto:obj.name,nome:'Lateral direita',w:dep,h,qty:1,thickness:mdf,material:`MDF ${mdf}mm`,grain:true,edge:'frente'});
      addPart(parts,{objeto:obj.name,nome:'Base',w:w,h:dep,qty:1,thickness:mdf,material:`MDF ${mdf}mm`,grain:true,edge:'frente'});
      addPart(parts,{objeto:obj.name,nome:'Topo',w:w,h:dep,qty:1,thickness:mdf,material:`MDF ${mdf}mm`,grain:true,edge:'frente'});
      addPart(parts,{objeto:obj.name,nome:'Prateleira',w:internalW,h:shelfD,qty:n(d.shelves,0),thickness:mdf,material:`MDF ${mdf}mm`,grain:true,edge:'frente'});
    }
    if(obj.type==='countertop'){
      const d=obj.data;
      if(String(d.material||'').toLowerCase().includes('mdf')){
        addPart(parts,{objeto:obj.name,nome:'Tampo MDF',w:n(d.w),h:n(d.d),qty:1,thickness:n(d.thick,18),material:`MDF ${n(d.thick,18)}mm`,grain:true,edge:'frente e laterais'});
      }
    }
    if(obj.type==='closet'){
      const d=obj.data;
      if(String(d.shelfMaterial||'').toLowerCase().includes('mdf')){
        const modules=Math.max(1,n(d.modules,1));
        const mw=n(d.w)/modules;
        addPart(parts,{objeto:obj.name,nome:'Prateleira closet MDF',w:mw-20,h:n(d.d)-30,qty:modules*n(d.shelves,0),thickness:18,material:'MDF 18mm',grain:true,edge:'frente'});
      }
    }
  });
  return parts;
}

function expand(parts:MdfPart[]):MdfPart[]{return parts.flatMap(p=>Array.from({length:p.qty},(_,i)=>({...p,id:`${p.id}-${i+1}`,qty:1})))}

export function nestMdfParts(parts:MdfPart[],sheetCfg:Partial<SheetCfg>={}):MdfSheetPlan[]{
  const cfg={...defaultSheet,...sheetCfg};
  const availableW=cfg.w-cfg.margin*2;
  const availableH=cfg.h-cfg.margin*2;
  const items=expand(parts).sort((a,b)=>Math.max(b.w,b.h)-Math.max(a.w,a.h)||b.w*b.h-a.w*a.h);
  const sheets:MdfSheetPlan[]=[];
  const newSheet=()=>{const sheet={sheet:sheets.length+1,w:cfg.w,h:cfg.h,usedArea:0,wasteArea:cfg.w*cfg.h,efficiency:0,parts:[] as PlacedPart[],_x:cfg.margin,_y:cfg.margin,_rowH:0} as any;sheets.push(sheet);return sheet};
  let sheet:any=newSheet();
  function placeOn(s:any,item:MdfPart):boolean{
    const tries=[{rot:false,w:item.w,h:item.h},{rot:!item.grain,w:item.h,h:item.w}].filter(t=>t.rot||t.w!==t.h);
    for(const t of tries){
      if(t.w>availableW||t.h>availableH)continue;
      if(s._x+t.w>cfg.w-cfg.margin){s._x=cfg.margin;s._y+=s._rowH+cfg.spacing+cfg.kerf;s._rowH=0}
      if(s._y+t.h>cfg.h-cfg.margin)continue;
      const placed={...item,sheet:s.sheet,x:s._x,y:s._y,rotated:t.rot,cutW:t.w,cutH:t.h};
      s.parts.push(placed);s.usedArea+=t.w*t.h;s._x+=t.w+cfg.spacing+cfg.kerf;s._rowH=Math.max(s._rowH,t.h);return true;
    }
    return false;
  }
  items.forEach(item=>{if(!placeOn(sheet,item)){sheet=newSheet();placeOn(sheet,item)}});
  sheets.forEach((s:any)=>{s.wasteArea=s.w*s.h-s.usedArea;s.efficiency=s.usedArea/(s.w*s.h)*100;delete s._x;delete s._y;delete s._rowH});
  return sheets;
}

export function buildMdfCutPlan(args:{objects:any[];rows:any[];sheet?:Partial<SheetCfg>}):MdfCutPlan{
  const cfg={...defaultSheet,...(args.sheet||{})};
  const parts=buildMdfParts(args.objects,args.rows);
  const sheets=nestMdfParts(parts,cfg);
  const totalArea=parts.reduce((s,p)=>s+(p.w*p.h*p.qty)/1000000,0);
  const warnings:string[]=[];
  parts.forEach(p=>{if(p.w>cfg.w-cfg.margin*2||p.h>cfg.h-cfg.margin*2)warnings.push(`${p.nome} de ${p.objeto} excede o tamanho útil da chapa.`)});
  if(!parts.length)warnings.push('Nenhuma peça de MDF encontrada no projeto. Adicione uma cristaleira ou objeto com MDF.');
  return{parts,sheets,totalArea,sheetArea:cfg.w*cfg.h/1000000,warnings};
}

export function formatMdfCutPlan(plan:MdfCutPlan){
  const out:string[]=['PLANO DE CORTE MDF - CNC','Chapa padrão: 2750 x 1850 mm',''];
  plan.sheets.forEach(s=>{out.push(`CHAPA ${s.sheet} - aproveitamento ${s.efficiency.toFixed(1)}%`);s.parts.forEach(p=>out.push(`${p.nome} | ${p.objeto} | ${p.cutW.toFixed(0)} x ${p.cutH.toFixed(0)} mm | X:${p.x.toFixed(0)} Y:${p.y.toFixed(0)}${p.rotated?' | GIRADA':''}${p.edge?` | Fita: ${p.edge}`:''}`));out.push('')});
  out.push(`Área total MDF: ${plan.totalArea.toFixed(2)} m²`, `Chapas: ${plan.sheets.length}`);
  if(plan.warnings.length)out.push('',...plan.warnings.map(w=>`⚠ ${w}`));
  return out.join('\n');
}
