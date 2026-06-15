import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

type BoxSize = { w: number; h: number; d: number };

type ConfiguratorSceneProps = {
  title: string;
  module: BoxSize;
  color?: string;
  showFactoryGuides?: boolean;
};

export function ConfiguratorScene({ title, module, color = '#8b623e', showFactoryGuides = false }: ConfiguratorSceneProps) {
  return (
    <div className="splitScene">
      <div className="splitSceneHeader">
        <span>3D</span>
        <b>{title}</b>
        <small>{module.w} x {module.h} x {module.d} mm</small>
      </div>
      <Canvas camera={{ position: [2.8, 2.1, 3.4], fov: 45 }}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 4, 5]} />
        <gridHelper args={[4, 10]} />
        <Cabinet module={module} color={color} showFactoryGuides={showFactoryGuides} />
        <OrbitControls />
      </Canvas>
    </div>
  );
}

function Cabinet({ module, color, showFactoryGuides }: { module: BoxSize; color: string; showFactoryGuides: boolean }) {
  const w = module.w / 1000;
  const h = module.h / 1000;
  const d = module.d / 1000;
  const thick = 0.035;

  return (
    <group position={[0, h / 2, 0]}>
      <Box p={[-w / 2 + thick / 2, 0, 0]} s={[thick, h, d]} color={color} />
      <Box p={[w / 2 - thick / 2, 0, 0]} s={[thick, h, d]} color={color} />
      <Box p={[0, h / 2 - thick / 2, 0]} s={[w, thick, d]} color={color} />
      <Box p={[0, -h / 2 + thick / 2, 0]} s={[w, thick, d]} color={color} />
      <Box p={[0, 0, d / 2 + 0.012]} s={[w - 0.08, h - 0.08, 0.018]} color="#7fa6c4" opacity={0.34} />
      <Box p={[0, 0, -d / 2 + 0.012]} s={[w - 0.08, h - 0.08, 0.018]} color="#222" opacity={0.28} />
      <Box p={[0, 0, d / 2 + 0.032]} s={[w, 0.035, 0.035]} color="#050505" />
      <Box p={[0, h / 2 - 0.017, d / 2 + 0.032]} s={[w, 0.035, 0.035]} color="#050505" />
      <Box p={[0, -h / 2 + 0.017, d / 2 + 0.032]} s={[w, 0.035, 0.035]} color="#050505" />
      {showFactoryGuides && (
        <>
          <Box p={[0, 0, 0]} s={[0.018, h, d + 0.08]} color="#f0d28a" opacity={0.42} />
          <Box p={[0, 0, 0]} s={[w + 0.08, 0.018, d + 0.08]} color="#75d493" opacity={0.34} />
        </>
      )}
    </group>
  );
}

function Box({ p, s, color, opacity = 1 }: { p: [number, number, number]; s: [number, number, number]; color: string; opacity?: number }) {
  return (
    <mesh position={p}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}
