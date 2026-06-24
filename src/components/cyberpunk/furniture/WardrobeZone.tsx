'use client';

import { NeonStrip, metalDark } from './shared';
import { FURNITURE_LAYOUT } from '../sceneLayout';
import { EditableGroup } from '../sceneEditor';
import type { HomepageSceneVariant } from '../theme';

function WardrobeCabinet({ variant }: { variant: HomepageSceneVariant }) {
  const layout = FURNITURE_LAYOUT.wardrobe;
  const isDay = variant === 'day';

  return (
    <EditableGroup id="wardrobe-zone" position={layout.position} rotation={layout.rotation}>
      <mesh position={[0, 1.15, -0.22]}>
        <boxGeometry args={[layout.bounds.width, layout.bounds.height, 0.08]} />
        <meshStandardMaterial color={isDay ? '#8b6845' : '#0b0b14'} metalness={isDay ? 0.08 : 0.48} roughness={isDay ? 0.78 : 0.44} />
      </mesh>
      <mesh position={[0, 2.15, 0]}>
        <boxGeometry args={[1.08, 0.04, 0.42]} />
        <meshStandardMaterial {...(isDay ? { color: '#6b4f32', metalness: 0.12, roughness: 0.68 } : metalDark)} />
      </mesh>
      <mesh position={[0, 1.72, 0.15]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 1.04, 10]} />
        <meshStandardMaterial {...(isDay ? { color: '#6b4f32', metalness: 0.12, roughness: 0.68 } : metalDark)} />
      </mesh>
      {[-0.36, -0.12, 0.14, 0.38].map((x, index) => (
        <mesh key={x} position={[x, 1.28, 0.12]} rotation={[0, 0, (index % 2 ? -0.03 : 0.03)]}>
          <boxGeometry args={[0.18, 0.82, 0.08]} />
          <meshStandardMaterial color={isDay ? (index % 2 ? '#d8c5ad' : '#cbd5e1') : (index % 2 ? '#171725' : '#26112c')} roughness={0.94} />
        </mesh>
      ))}
      <NeonStrip position={[0, 0.72, 0.27]} scale={[1.06, 0.035, 0.03]} color={isDay ? '#fbbf24' : '#ff2a9a'} intensity={isDay ? 0.1 : 1.1} />
      <NeonStrip position={[0.62, 1.45, 0.03]} scale={[0.025, 1.35, 0.025]} color={isDay ? '#bfdbfe' : '#7b61ff'} intensity={isDay ? 0.08 : 1.0} />
    </EditableGroup>
  );
}

export default function WardrobeZone({ variant }: { variant: HomepageSceneVariant }) {
  return <WardrobeCabinet variant={variant} />;
}
