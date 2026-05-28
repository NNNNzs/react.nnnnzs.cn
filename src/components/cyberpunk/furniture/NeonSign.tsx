'use client';

import { Text } from '@react-three/drei';
import { FURNITURE_LAYOUT } from '../sceneLayout';
import { EditableGroup } from '../sceneEditor';

export default function NeonSign({ variant }: { variant: 'day' | 'night' }) {
  const layout = FURNITURE_LAYOUT.neonSign;
  const isDay = variant === 'day';

  return (
    <EditableGroup id="neon-sign" position={layout.position} rotation={layout.rotation}>
      <mesh>
        <planeGeometry args={[1.4, 0.55]} />
        <meshStandardMaterial
          color={isDay ? '#f8fafc' : '#160617'}
          emissive={isDay ? '#38bdf8' : '#ff2a9a'}
          emissiveIntensity={isDay ? 0.08 : 0.58}
          transparent
          opacity={0.82}
          toneMapped={false}
        />
      </mesh>
      <Text position={[0, 0.03, 0.02]} fontSize={0.18} anchorX="center" anchorY="middle" color={isDay ? '#0f172a' : '#ffd8f2'}>
        NO
      </Text>
      <Text position={[0, -0.18, 0.02]} fontSize={0.12} anchorX="center" anchorY="middle" color={isDay ? '#0f172a' : '#ffd8f2'}>
        FUTURE
      </Text>
    </EditableGroup>
  );
}
