import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import './freeTemplateBuilder.css';

export type FreePieceType = 'mdf' | 'vidro' | 'perfil' | 'prateleira' | 'acessorio' | 'volume';

export type FreePiece = {
  id: string;
  nome: string;
  tipo: FreePieceType;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  material: string;
};

export const freePiecesInicial: FreePiece[] = [
  { id: 'piso-1', nome: 'Base MDF', tipo: 'mdf', x: 0, y: 40, z: 0, w: 1000, h: 80, d: 450, material: 'mdf_18' },
  { id: 'lat-esq-1', nome: 'Lateral esquerda', tipo: 'mdf', x: -480, y: 1100, z: 0, w: 40, h: 2200, d: 450, material: 'mdf_18' },
  { id: 'lat-dir-1', nome: 'Lateral direita', tipo: 'mdf', x: 480, y: 1100, z: 0, w: 40, h: 2200, d: 450, material: 'mdf_18' },
  { id: 'porta-vidro-1', nome: 'Porta vidro', tipo: 'vidro', x: 0, y: 1100, z: 235, w: 900, h: 2050, d: 20, material: 'reflecta_bronze' },
];

type Props = {
  pieces: FreePiece[];
  setPieces: (pieces: FreePiece[]) => void;
};

export function FreeTemplateBuilder({ pieces, setPieces }: Props) {
  const [selectedId, setSelectedId] = React.useState(pieces[0]?.id || '');
  const selected = pieces.find((piece) => piece.id === selectedId) || null;

  function addPiece(tipo: FreePieceType) {
    const next: FreePiece = {
      id: `${tipo}-${Date.now()}`,
      nome: `Nova peça ${tipo}`,
      tipo,
      x: 0,
      y: 1000,
      z: 0,
      w: tipo === 'perfil' ? 40 : 500,
      h: tipo === 'perfil' ? 2100 : 500,
      d: tipo === 'vidro' ? 18 : 80,
      material: tipo,
    };
    setPieces([...pieces, next]);
    setSelectedId(next.id);
  }

  function updateSelected(partial: Partial<FreePiece>) {
    if (!selected) return;
    setPieces(pieces.map((piece) => piece.id === selected.id ? { ...piece, ...partial } : piece));
  }

  function removeSelected() {
    if (!selected) return;
    const next = pieces.filter((piece) => piece.id !== selected.id);
    setPieces(next);
    setSelectedId(next[0]?.id || '');
  }

  return (
    <div className="freeBuilder">
      <div className="freeToolbar">
        <button onClick={() => addPiece('mdf')}>+ MDF</button>
        <button onClick={() => addPiece('vidro')}>+ Vidro</button>
        <button onClick={() => addPiece('perfil')}>+ Perfil</button>
        <button onClick={() => addPiece('prateleira')}>+ Prateleira</button>
        <button onClick={() => addPiece('acessorio')}>+ Acessório</button>
      </div>

      <div className="freeEditorGrid">
        <div className="freeList">
          <b>Peças do template</b>
          {pieces.map((piece) => (
            <button key={piece.id} className={piece.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(piece.id)}>
              <span>{piece.nome}</span>
              <small>{piece.tipo} · {piece.w}x{piece.h}x{piece.d}</small>
            </button>
          ))}
        </div>

        <div className="freeInspector">
          <b>Editar peça</b>
          {!selected ? <p>Nenhuma peça selecionada.</p> : (
            <>
              <label>Nome<input value={selected.nome} onChange={(e) => updateSelected({ nome: e.target.value })} /></label>
              <label>Tipo<select value={selected.tipo} onChange={(e) => updateSelected({ tipo: e.target.value as FreePieceType })}><option value="mdf">MDF</option><option value="vidro">Vidro</option><option value="perfil">Perfil</option><option value="prateleira">Prateleira</option><option value="acessorio">Acessório</option><option value="volume">Volume</option></select></label>
              <label>Material<input value={selected.material} onChange={(e) => updateSelected({ material: e.target.value })} /></label>
              <div className="freeNumberGrid">
                <NumberInput label="X" value={selected.x} onChange={(v) => updateSelected({ x: v })} />
                <NumberInput label="Y" value={selected.y} onChange={(v) => updateSelected({ y: v })} />
                <NumberInput label="Z" value={selected.z} onChange={(v) => updateSelected({ z: v })} />
                <NumberInput label="Largura" value={selected.w} onChange={(v) => updateSelected({ w: v })} />
                <NumberInput label="Altura" value={selected.h} onChange={(v) => updateSelected({ h: v })} />
                <NumberInput label="Prof." value={selected.d} onChange={(v) => updateSelected({ d: v })} />
              </div>
              <button className="freeDanger" onClick={removeSelected}>Remover peça</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function FreeTemplateScene({ pieces }: { pieces: FreePiece[] }) {
  return (
    <div className="splitScene">
      <div className="splitSceneHeader"><span>3D Livre</span><b>Template livre da fábrica</b><small>{pieces.length} peças</small></div>
      <Canvas camera={{ position: [3.2, 2.6, 4.2], fov: 45 }}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 4, 5]} />
        <gridHelper args={[5, 12]} />
        {pieces.map((piece) => <FreePieceMesh key={piece.id} piece={piece} />)}
        <OrbitControls />
      </Canvas>
    </div>
  );
}

function FreePieceMesh({ piece }: { piece: FreePiece }) {
  const color = piece.tipo === 'vidro' ? '#85b8d8' : piece.tipo === 'perfil' ? '#111111' : piece.tipo === 'mdf' ? '#8b623e' : piece.tipo === 'prateleira' ? '#b48a5a' : '#d8aa58';
  const opacity = piece.tipo === 'vidro' ? 0.38 : 1;
  return (
    <mesh position={[piece.x / 1000, piece.y / 1000, piece.z / 1000]}>
      <boxGeometry args={[piece.w / 1000, piece.h / 1000, piece.d / 1000]} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return <label>{label}<input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}
