'use client';

import { RoundedBox } from '@react-three/drei';
import { BlinkingLED, NeonStrip, metalDark } from './shared';
import { FURNITURE_LAYOUT } from '../sceneLayout';
import { EditableGroup } from '../sceneEditor';
import type { HomepageSceneVariant } from '../theme';

function BedPlatform({ variant }: { variant: HomepageSceneVariant }) {
  const bed = FURNITURE_LAYOUT.bed;
  const isDay = variant === 'day';

  return (
    <EditableGroup id="sleep-bed" position={bed.position}>
      <RoundedBox position={[0, 0.22, 0]} args={[bed.bounds.width, 0.22, bed.bounds.depth]} radius={0.03} smoothness={3}>
        <meshStandardMaterial color={isDay ? '#c89b6a' : '#0c0c14'} metalness={isDay ? 0.06 : 0.22} roughness={isDay ? 0.82 : 0.74} />
      </RoundedBox>
      <RoundedBox position={[0, 0.39, 0]} args={[2.0, 0.2, 1.18]} radius={0.06} smoothness={3}>
        <meshStandardMaterial color={isDay ? '#f5ede0' : '#171725'} roughness={0.96} />
      </RoundedBox>
      <RoundedBox position={[0.05, 0.55, 0.12]} rotation={[0.02, -0.06, 0.02]} args={[1.8, 0.18, 0.82]} radius={0.07} smoothness={3}>
        <meshStandardMaterial color={isDay ? '#f8fafc' : '#11111f'} roughness={0.98} />
      </RoundedBox>
      <mesh position={[-0.58, 0.62, -0.42]}>
        <boxGeometry args={[0.5, 0.13, 0.28]} />
        <meshStandardMaterial color={isDay ? '#d8c5ad' : '#202033'} roughness={0.96} />
      </mesh>
      <mesh position={[0.12, 0.61, -0.45]}>
        <boxGeometry args={[0.48, 0.12, 0.28]} />
        <meshStandardMaterial color={isDay ? '#cbd5e1' : '#1b1b2d'} roughness={0.96} />
      </mesh>
      <NeonStrip position={[0, 0.16, 0.72]} scale={[2.02, 0.035, 0.035]} color={isDay ? '#fbbf24' : '#ff2a9a'} intensity={isDay ? 0.1 : 0.7} />
    </EditableGroup>
  );
}

function Nightstand({ variant }: { variant: HomepageSceneVariant }) {
  const isDay = variant === 'day';

  return (
    <EditableGroup id="sleep-nightstand" position={FURNITURE_LAYOUT.nightstand.position}>
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[0.48, 0.55, 0.4]} />
        <meshStandardMaterial {...(isDay ? { color: '#c89b6a', metalness: 0.08, roughness: 0.78 } : metalDark)} />
      </mesh>
      <BlinkingLED position={[0.16, 0.48, 0.22]} color={isDay ? '#f59e0b' : '#00f0ff'} />
    </EditableGroup>
  );
}

function PosterPanel({ variant }: { variant: HomepageSceneVariant }) {
  const isDay = variant === 'day';

  return (
    <EditableGroup
      id="sleep-poster"
      position={FURNITURE_LAYOUT.neonPoster.position}
      rotation={FURNITURE_LAYOUT.neonPoster.rotation}
    >
      <mesh>
        <planeGeometry args={[0.78, 0.78]} />
        <meshStandardMaterial color={isDay ? '#fff7ed' : '#050712'} emissive={isDay ? '#fde68a' : '#00f0ff'} emissiveIntensity={isDay ? 0.025 : 0.16} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.015]}>
        <ringGeometry args={[0.24, 0.3, 40]} />
        <meshStandardMaterial color={isDay ? '#0ea5e9' : '#00f0ff'} emissive={isDay ? '#bae6fd' : '#00f0ff'} emissiveIntensity={isDay ? 0.16 : 1.2} toneMapped={false} />
      </mesh>
    </EditableGroup>
  );
}

export default function SleepZone({ variant }: { variant: HomepageSceneVariant }) {
  return (
    <>
      <BedPlatform variant={variant} />
      <Nightstand variant={variant} />
      <PosterPanel variant={variant} />
    </>
  );
}
