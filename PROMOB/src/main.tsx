import React from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import './style.css';

type Config={h:number;w:number;d:number;mdf:number;shelves:number;doors:number;margin:number;profile:string;glass:string};
const pp:Record<string,number>={'1036':19,'070':18,'3545':22,'3446':24};
const gp:Record<string,number>={incolor:120,espelho_prata:180,reflecta_bronze:230,reflecta_prata:220,fume:170};
function calc(c:Config){const uw=c.w-c.mdf*2,uh=c.h-c.mdf*2,dw=uw/c.doors;const ga=(dw/1000)*(uh/1000)*c.doors*1.1;const pm=((dw/1000)*2+(uh/1000)*2)*c.doors*1.1;const ma=(c.h/1000*c.d/1000*2)+(c.w/1000*c.d/1000*2)+(uw/1000*(c.d-c.mdf)/1000*c.shelves);const cost=ga*gp[c.glass]+pm*pp[c.profile]+ma*115+pm*1.2+c.doors*4.84+c.doors*35+80;return{uw,uh,dw,ga,pm,ma,cost,sale:cost/(1-c.margin/100)}}
function App(){
 const[c,setC]=React.useState<Config>({h:2200,w:1000,d:450,mdf:18,shelves:4,doors:2,margin:45,profile:'1036',glass:'reflecta_bronze'});
 const[moveisOpen,setMoveisOpen]=React.useState(false);
 const[hasCristaleira,setHasCristaleira]=React.useState(false);
 const[resultadoOpen,setResultadoOpen]=React.useState(false);
 const[paramsOpen,setParamsOpen]=React.useState(false);
 const r=calc(c);
 const n=(k:keyof Config)=>(e:React.ChangeEvent<HTMLInputElement>)=>setC({...c,[k]:Number(e.target.value)});
 const s=(k:keyof Config)=>(e:React.ChangeEvent<HTMLSelectElement>)=>setC({...c,[k]:e.target.value});
 const left=moveisOpen?360:64;
 const right=resultadoOpen?340:64;
 return <main className="app" style={{gridTemplateColumns:`${left}px 1fr ${right}px`}}>
  <aside className="side leftSide"><button className="flag" onClick={()=>setMoveisOpen(!moveisOpen)}>Móveis</button>{moveisOpen&&<div className="sideBody"><h2 className="menuTitle">Estruturas</h2>{!hasCristaleira?<button className="addBtn" onClick={()=>setHasCristaleira(true)}>Cristaleira +</button>:<CristaleiraForm c={c} n={n} s={s}/>}<button className="groupTitle" onClick={()=>setParamsOpen(!paramsOpen)}>Parâmetros {paramsOpen?'−':'+'}</button>{paramsOpen&&<Parametros c={c}/>}</div>}</aside>
  <section className="workspace"><div className="scene">{hasCristaleira?<Canvas camera={{position:[1.8,1.2,2.2],fov:45}}><ambientLight intensity={0.8}/><directionalLight position={[3,4,5]}/><Cab c={c} r={r}/><OrbitControls/></Canvas>:<div className="empty"><h2>Nenhuma estrutura adicionada</h2><p>Clique em Móveis e depois em Cristaleira + para começar.</p></div>}</div></section>
  <aside className="side rightSide"><button className="flag rightFlag" onClick={()=>setResultadoOpen(!resultadoOpen)}>Resultado</button>{resultadoOpen&&<Resultado has={hasCristaleira} r={r}/>}</aside>
 </main>
}
function CristaleiraForm({c,n,s}:{c:Config;n:(k:keyof Config)=>(e:React.ChangeEvent<HTMLInputElement>)=>void;s:(k:keyof Config)=>(e:React.ChangeEvent<HTMLSelectElement>)=>void}){return <div className="formBox"><h2>Cristaleira</h2><F l="Altura" v={c.h} f={n('h')}/><F l="Largura" v={c.w} f={n('w')}/><F l="Profundidade" v={c.d} f={n('d')}/><F l="MDF" v={c.mdf} f={n('mdf')}/><F l="Prateleiras" v={c.shelves} f={n('shelves')}/><F l="Portas" v={c.doors} f={n('doors')}/><F l="Margem" v={c.margin} f={n('margin')}/><label>Perfil<select value={c.profile} onChange={s('profile')}><option value="1036">1036</option><option value="070">070</option><option value="3545">3545</option><option value="3446">3446</option></select></label><label>Vidro<select value={c.glass} onChange={s('glass')}><option value="incolor">Incolor</option><option value="espelho_prata">Espelho prata</option><option value="reflecta_bronze">Reflecta bronze</option><option value="reflecta_prata">Reflecta prata</option><option value="fume">Fume</option></select></label></div>}
function Parametros({c}:{c:Config}){return <div className="params"><div className="paramCard"><h3>Cristaleira</h3><Param n="Altura" v={`${c.h} mm`}/><Param n="Largura" v={`${c.w} mm`}/><Param n="Profundidade" v={`${c.d} mm`}/><Param n="Espessura MDF" v={`${c.mdf} mm`}/><Param n="Prateleiras" v={`${c.shelves}`}/><Param n="Portas" v={`${c.doors}`}/><Param n="Margem" v={`${c.margin}%`}/><Param n="Perfil" v={c.profile}/><Param n="Vidro" v={c.glass}/></div><div className="paramCard"><h3>Porta de alumínio</h3><Param n="Altura" v="Vão útil da cristaleira"/><Param n="Largura" v="Vão útil dividido pelas portas"/><Param n="Perfil" v={c.profile}/><Param n="Vidro" v={c.glass}/><Param n="Espessura do vidro" v="4 mm"/><Param n="Baguete" v="Perímetro da porta"/><Param n="Kit montagem" v="1 kit por porta"/><Param n="Perda" v="10%"/><Param n="Mão de obra" v="R$ 35 por porta"/></div></div>}
function Resultado({has,r}:{has:boolean;r:ReturnType<typeof calc>}){return <div className="sideBody resultBody">{has?<><h2>Resultado</h2><p>Vao util: {Math.round(r.uw)} x {Math.round(r.uh)} mm</p><p>Cada porta: {Math.round(r.dw)} x {Math.round(r.uh)} mm</p><p>Vidro: {r.ga.toFixed(2)} m2</p><p>Perfil: {r.pm.toFixed(2)} m</p><p>MDF: {r.ma.toFixed(2)} m2</p><p>Custo: R$ {r.cost.toFixed(2)}</p><p>Venda: R$ {r.sale.toFixed(2)}</p></>:<p>Adicione uma estrutura primeiro.</p>}</div>}
function Param({n,v}:{n:string;v:string}){return <div className="paramRow"><span>{n}</span><b>{v}</b></div>}
function F(p:{l:string;v:number;f:(e:React.ChangeEvent<HTMLInputElement>)=>void}){return <label>{p.l}<input type="number" value={p.v} onChange={p.f}/></label>}
function Cab({c,r}:{c:Config;r:ReturnType<typeof calc>}){const w=c.w/1000,h=c.h/1000,d=c.d/1000,m=c.mdf/1000,uw=r.uw/1000,uh=r.uh/1000;return <group position={[0,h/2,0]}><B p={[-w/2+m/2,0,0]} z={[m,h,d]} color="#7a5232"/><B p={[w/2-m/2,0,0]} z={[m,h,d]} color="#7a5232"/><B p={[0,h/2-m/2,0]} z={[w,m,d]} color="#7a5232"/><B p={[0,-h/2+m/2,0]} z={[w,m,d]} color="#7a5232"/>{Array.from({length:c.shelves}).map((_,i)=><B key={i} p={[0,-uh/2+(i+1)*uh/(c.shelves+1),0]} z={[uw,m,d-m]} color="#8b623e"/>)}{Array.from({length:c.doors}).map((_,i)=><Door key={i} x={-uw/2+(r.dw/1000)/2+i*(uw/c.doors)} w={r.dw/1000} h={uh} z={d/2+0.02}/>)}</group>}
function Door({x,w,h,z}:{x:number;w:number;h:number;z:number}){const b=.035;return <group position={[x,0,z]}><B p={[0,0,0]} z={[w-b*2,h-b*2,.01]} color="#7f5a35" opacity={.45}/><B p={[0,h/2-b/2,.01]} z={[w,b,.03]} color="#050505"/><B p={[0,-h/2+b/2,.01]} z={[w,b,.03]} color="#050505"/><B p={[-w/2+b/2,0,.01]} z={[b,h,.03]} color="#050505"/><B p={[w/2-b/2,0,.01]} z={[b,h,.03]} color="#050505"/></group>}
function B({p,z,color,opacity=1}:{p:[number,number,number];z:[number,number,number];color:string;opacity?:number}){return <mesh position={p}><boxGeometry args={z}/><meshStandardMaterial color={color} transparent={opacity<1} opacity={opacity}/></mesh>}
createRoot(document.getElementById('root') as HTMLElement).render(<React.StrictMode><App/></React.StrictMode>);
