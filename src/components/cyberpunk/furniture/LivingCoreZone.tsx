'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { NeonStrip, metalDark } from './shared';
import { FURNITURE_LAYOUT } from '../sceneLayout';
import { Text } from '@react-three/drei';
import { EditableGroup } from '../sceneEditor';

function HologramCore({ variant }: { variant: 'day' | 'night' }) {
  const ref = useRef<THREE.Group>(null);
  const color = variant === 'day' ? '#0ea5e9' : '#ff2a9a';

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 0.9 + Math.sin(clock.getElapsedTime() * 1.1) * 0.045;
    ref.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.3) * 0.08;
  });

  return (
    <group ref={ref} position={[0, 0.9, 0]}>
      <mesh>
        <boxGeometry args={[0.52, 0.58, 0.035]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.65} transparent opacity={0.34} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.39, 36]} />
        <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={0.75} transparent opacity={0.45} toneMapped={false} />
      </mesh>
      <Text position={[0, 0, 0.03]} fontSize={0.08} anchorX="center" anchorY="middle" color="#ffffff">
        POSTS
      </Text>
    </group>
  );
}

function CoffeeTableCluster({ variant }: { variant: 'day' | 'night' }) {
  const table = FURNITURE_LAYOUT.coffeeTable;

  return (
    <group position={table.position}>
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[table.bounds.width, 0.08, table.bounds.depth]} />
        <meshStandardMaterial color="#101018" metalness={0.5} roughness={0.28} transparent opacity={0.78} />
      </mesh>
      {[
        [-0.75, 0.18, -0.32],
        [0.75, 0.18, -0.32],
        [-0.75, 0.18, 0.32],
        [0.75, 0.18, 0.32],
      ].map((pos, index) => (
        <mesh key={index} position={pos as [number, number, number]}>
          <boxGeometry args={[0.05, 0.36, 0.05]} />
          <meshStandardMaterial {...metalDark} />
        </mesh>
      ))}
      <HologramCore variant={variant} />
      <mesh position={[-0.55, 0.45, 0.2]}>
        <cylinderGeometry args={[0.04, 0.035, 0.16, 14]} />
        <meshStandardMaterial color="#181827" roughness={0.7} />
      </mesh>
      <mesh position={[0.6, 0.48, -0.12]}>
        <cylinderGeometry args={[0.035, 0.032, 0.22, 12]} />
        <meshStandardMaterial color="#231026" emissive="#ff2a9a" emissiveIntensity={0.08} />
      </mesh>
    </group>
  );
}

function SofaCluster() {
  const sofa = FURNITURE_LAYOUT.sofa;

  return (
    <group position={sofa.position} rotation={sofa.rotation}>
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[sofa.bounds.width, 0.46, sofa.bounds.depth]} />
        <meshStandardMaterial color="#11111b" roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.78, -0.28]}>
        <boxGeometry args={[sofa.bounds.width, 0.7, 0.18]} />
        <meshStandardMaterial color="#0d0d16" roughness={0.9} />
      </mesh>
      {[-0.68, 0, 0.68].map((x) => (
        <mesh key={x} position={[x, 0.65, 0.02]} rotation={[0.05, 0, 0]}>
          <boxGeometry args={[0.55, 0.16, 0.45]} />
          <meshStandardMaterial color="#151521" roughness={0.96} />
        </mesh>
      ))}
      <NeonStrip position={[0, 0.16, 0.37]} scale={[2.18, 0.035, 0.03]} color="#ff2a9a" intensity={1.2} />
    </group>
  );
}

export default function LivingCoreZone({ variant }: { variant: 'day' | 'night' }) {
  return (
    <EditableGroup id="living-core-zone">
      <mesh position={[-0.08, 0.012, 0.72]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 1.55]} />
        <meshStandardMaterial color="#111122" roughness={0.86} metalness={0.12} />
      </mesh>
      <NeonStrip position={[-0.08, 0.03, -0.03]} scale={[2.6, 0.018, 0.018]} color="#00d8ff" intensity={0.42} />
      <NeonStrip position={[-0.08, 0.03, 1.47]} scale={[2.6, 0.018, 0.018]} color="#ff2a9a" intensity={0.42} />
      <CoffeeTableCluster variant={variant} />
      <SofaCluster />
    </EditableGroup>
  );
}
