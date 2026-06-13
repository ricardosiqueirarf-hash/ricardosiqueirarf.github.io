import React from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import './style.css';

type Config = { h:number; w:number; d:number; mdf:number; shelves:number; doors:number; margin:number; profile:string; glass:string };
const profilePrice: Record<string, number> = { '1036': 19, '070': 18, '3545': 22, '3446': 24 };
const glassPrice: Record<string, number> = { incolor:120, espelho_prata:180, reflecta_bronze:230, reflecta_prata:220, fume:170 };

function calc(c: Config) {
  const usefulW = c.w - c.mdf * 2;
  const usefulH = c.h - c.mdf * 2;
  const doorW = usefulW / c.doors;
  const glassM2 = (doorW / 1000) * (usefulH / 1000) * c.doors * 1.1;
  const profileM = ((doorW / 1000) * 2 + (usefulH / 1000) * 2) * c.doors * 1.1;
  const mdfM2 = (c.h/1000*c.d/1000*2) + (c.w/1000*c.d/1000*2) + (usefulW/1000*(c.d-c.mdf)/1000*c.shelves);
  const cost = glassM2*glassPrice[c.glass] + profileM*profilePrice[c.profile] + mdfM2*115 + profileM*1.2 + c.doors*4.84 + c.doors*35 + 80;
  return { usefulW, usefulH, doorW, glassM2, profileM, mdfM2, cost, sale: cost/(1-c.margin/100) };
}

function App(){
  const [c,setC] = React.useState<Config>({h:2200,w:1000,d:450,mdf:18,shelves:4,doors:2,margin:45,profile:'1036',glass:'reflecta_bronze'});
  const r = calc(c);
  const num = (k:keyof Config)=>(e:React.ChangeEvent<HTMLInputElement>)=>setC({...c,[k]:Number(e.target.value)});
  const str = (k:keyof Config)=>(e:React.ChangeEvent<HTMLSelectElement>)=>setC({...c,[k]:e.target.value});
  return <main className="app"><aside className="panel"><h2>Cristaleira</h2><Field l="Altura" v={c.h} f={num('h')}/><Field l="Largura" v={c.w} f={num('w')}/><Field l="Profundidade" v={c.d} f={num('d')}/><Field l="MDF" v={c.mdf} f={num('mdf')}/><Field l="Prateleiras" v={c.shelves} f={num('shelves')}/><Field l="Portas" v={c.doors} f={num('doors')}/><Field l="Margem" v={c.margin} f={num('margin')}/><label>Perfil<select value={c.profile} onChange={str('profile')}><option value="1036">1036</option><option value="070">070</option><option value="3545">3545</option><option value="3446">3446</option></select></label><label>Vidro<select value={c.glass} onChange={str('glass')}><option value="incolor">Incolor</option><option value="espelho_prata">Espelho prata</option><option value="reflecta_bronze">Reflecta bronze</option><option value="reflecta_prata">Reflecta prata</option><option value="fume">Fume</option></select></label></aside><section><header><h1>Configurador ColorGlass</h1><p>MVP 3D tecnico de cristaleira</p></header><div className="scene"><Canvas camera={{position:[1.8,1.2,2.2],fov:45}}><ambientLight intensity={0.8}/><directionalLight position={[3,4,5]}/><Cabinet c={c} r={r}/><OrbitControls/></Canvas></div></section><aside className="panel"><h2>Resultado</h2><p>Vao util: {Math.round(r.usefulW)} x {Math.round(r.usefulH)} mm</p><p>Cada porta: {Math.round(r.doorW)} x {Math.round(r.usefulH)} mm</p><p>Vidro: {r.glassM2.toFixed(2)} m2</p><p>Perfil: {r.profileM.toFixed(2)} m</p><p>MDF: {r.mdfM2.toFixed(2)} m2</p><p>Custo: R$ {r.cost.toFixed(2)}</p><p>Venda: R$ {r.sale.toFixed(2)}</p></aside></main>
}
function Field(p:{l:string;v:number;f:(e:React.ChangeEvent<HTMLInputElement>)=>void}){return <label>{p.l}<input type="number" value={p.v} onChange={p.f}/></label>}
function Cabinet({c,r}:{c:Config;r:ReturnType<typeof calc>}){const w=c.w/1000,h=c.h/1000,d=c.d/1000,m=c.mdf/1000,uw=r.usefulW/1000,uh=r.usefulH/1000;return <group position={[0,h/2,0]}><Box p={[-w/2+m/2,0,0]} s={[m,h,d]} color="#7a5232"/><Box p={[w/2-m/2,0,0]} s={[m,h,d]} color="#7a5232"/><Box p={[0,h/2-m/2,0]} s={[w,m,d]} color="#7a5232"/><Box p={[0,-h/2+m/2,0]} s={[w,m,d]} color="#7a5232"/>{Array.from({length:c.shelves}).map((_,i)=><Box key={i} p={[0,-uh/2+(i+1)*uh/(c.shelves+1),0]} s={[uw,m,d-m]} color="#8b623e"/>)}{Array.from({length:c.doors}).map((_,i)=><Door key={i} x={-uw/2+(r.doorW/1000)/2+i*(uw/c.doors)} w={r.doorW/1000} h={uh} z={d/2+0.02}/>)}</group>}
function Door({x,w,h,z}:{x:number;w:number;h:number;z:number}){const b=.035;return <group position={[x,0,z]}><Box p={[0,0,0]} s={[w-b*2,h-b*2,.01]} color="#7f5a35" opacity={.45}/><Box p={[0,h/2-b/2,.01]} s={[w,b,.03]} color="#050505"/><Box p={[0,-h/2+b/2,.01]} s={[w,b,.03]} color="#050505"/><Box p={[-w/2+b/2,0,.01]} s={[b,h,.03]} color="#050505"/><Box p={[w/2-b/2,0,.01]} s={[b,h,.03]} color="#050505"/></group>}
function Box({p,s,color,opacity=1}:{p:[number,number,number];s:[number,number,number];color:string;opacity?:number}){return <mesh position={p}><boxGeometry args={s}/><meshStandardMaterial color={color} transparent={opacity<1} opacity={opacity}/></mesh>}

createRoot(document.getElementById('root') as HTMLElement).render(<React.StrictMode><App/></React.StrictMode>);
