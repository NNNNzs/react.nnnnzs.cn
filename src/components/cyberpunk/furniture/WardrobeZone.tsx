'use client';

import { NeonStrip, metalDark } from './shared';
import { FURNITURE_LAYOUT } from '../sceneLayout';

export default function WardrobeZone() {
  const layout = FURNITURE_LAYOUT.wardrobe;

  return (
    <group position={layout.position} rotation={layout.rotation}>
      <mesh position={[0, 1.15, -0.22]}>
        <boxGeometry args={[layout.bounds.width, layout.bounds.height, 0.08]} />
        <meshStandardMaterial color="#0b0b14" metalness={0.48} roughness={0.44} />
      </mesh>
      <mesh position={[0, 2.15, 0]}>
        <boxGeometry args={[1.08, 0.04, 0.42]} />
        <meshStandardMaterial {...metalDark} />
      </mesh>
      <mesh position={[0, 1.72, 0.15]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 1.04, 10]} />
        <meshStandardMaterial {...metalDark} />
      </mesh>
      {[-0.36, -0.12, 0.14, 0.38].map((x, index) => (
        <mesh key={x} position={[x, 1.28, 0.12]} rotation={[0, 0, (index % 2 ? -0.03 : 0.03)]}>
          <boxGeometry args={[0.18, 0.82, 0.08]} />
          <meshStandardMaterial color={index % 2 ? '#171725' : '#26112c'} roughness={0.94} />
        </mesh>
      ))}
      <NeonStrip position={[0, 0.72, 0.27]} scale={[1.06, 0.035, 0.03]} color="#ff2a9a" intensity={1.1} />
      <NeonStrip position={[0.62, 1.45, 0.03]} scale={[0.025, 1.35, 0.025]} color="#7b61ff" intensity={1.0} />
    </group>
  );
}
