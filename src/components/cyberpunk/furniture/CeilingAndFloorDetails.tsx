'use client';

import { BlinkingLED, Cable } from './shared';
import { FURNITURE_LAYOUT } from '../sceneLayout';

export default function CeilingAndFloorDetails({ variant }: { variant: 'day' | 'night' }) {
  return (
    <group>
      {[
        { position: [-1.85, 0.014, 0.02] as [number, number, number], scale: [1.18, 0.4, 1] as [number, number, number], color: '#00f0ff' },
        { position: [1.05, 0.015, 0.9] as [number, number, number], scale: [1.05, 0.32, 1] as [number, number, number], color: '#ff2a9a' },
        { position: [2.25, 0.016, 0.18] as [number, number, number], scale: [0.92, 0.24, 1] as [number, number, number], color: '#7b61ff' },
      ].map((item, index) => (
        <mesh key={index} position={item.position} rotation={[-Math.PI / 2, 0, index * 0.32]} scale={item.scale}>
          <circleGeometry args={[0.56, 32]} />
          <meshStandardMaterial
            color={item.color}
            emissive={item.color}
            emissiveIntensity={variant === 'day' ? 0.08 : 0.22}
            transparent
            opacity={variant === 'day' ? 0.08 : 0.16}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      <Cable points={[[-2.75, 0.03, -1.68], [-2.05, 0.02, -0.82], [-0.95, 0.025, 0.08], [0.05, 0.02, 0.52]]} />
      <Cable points={[[1.25, 0.03, -2.55], [2.0, 0.02, -2.08], [3.05, 0.025, -1.42]]} radius={0.008} />
      <Cable points={[[-0.55, 0.025, 2.18], [-1.3, 0.02, 2.6], [-2.28, 0.03, 2.62]]} radius={0.009} />

      <group position={FURNITURE_LAYOUT.robotPet.position} rotation={FURNITURE_LAYOUT.robotPet.rotation}>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.18, 0.2, 0.12, 24]} />
          <meshStandardMaterial color="#0d0d15" metalness={0.7} roughness={0.28} />
        </mesh>
        <BlinkingLED position={[0, 0.16, 0.15]} color="#00f0ff" />
      </group>
    </group>
  );
}
