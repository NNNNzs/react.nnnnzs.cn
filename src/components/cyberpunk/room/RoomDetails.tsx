'use client';

import type { HomepageSceneVariant } from '../theme';
import { ROOM } from './shared';

export default function RoomDetails({ variant }: { variant: HomepageSceneVariant }) {
  return (
    <mesh position={[0, 0.03, -ROOM.depth / 2 + 0.02]}>
      <boxGeometry args={[ROOM.width, 0.06, 0.02]} />
      <meshStandardMaterial color={variant === 'day' ? '#d7c4a5' : '#0a0a15'} emissive={variant === 'day' ? '#ffe8bf' : '#00f0ff'} emissiveIntensity={variant === 'day' ? 0.015 : 0.05} />
    </mesh>
  );
}
