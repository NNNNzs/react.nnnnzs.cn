'use client';

import { ROOM_OBJECTS } from '../sceneLayout';
import type { HomepageSceneVariant } from '../theme';

export default function PipeSystem({ variant }: { variant: HomepageSceneVariant }) {
  return (
    <>
      {/* 管线和桥架属于结构层，直接复用布局数据，便于统一对齐和维护 */}
      {ROOM_OBJECTS.ceilingPipes.map((pipe, i) => (
        <mesh key={`hpipe-${i}`} position={pipe.position} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[pipe.radius, pipe.radius, pipe.length, 8]} />
          <meshStandardMaterial color={variant === 'day' ? '#8b97a6' : '#1a1a2a'} metalness={variant === 'day' ? 0.35 : 0.85} roughness={0.25} />
        </mesh>
      ))}

      {ROOM_OBJECTS.depthPipes.map((pipe, i) => (
        <mesh key={`vpipe-${i}`} position={pipe.position} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[pipe.radius, pipe.radius, pipe.length, 8]} />
          <meshStandardMaterial color={variant === 'day' ? '#94a3b8' : '#15152a'} metalness={variant === 'day' ? 0.35 : 0.85} roughness={0.25} />
        </mesh>
      ))}

      {ROOM_OBJECTS.cableTrays.map((tray, i) => (
        <mesh key={`tray-${i}`} position={tray.position}>
          <boxGeometry args={[tray.bounds.width, tray.bounds.height, tray.bounds.depth]} />
          <meshStandardMaterial color={variant === 'day' ? '#9aa6b5' : '#1a1a2a'} metalness={variant === 'day' ? 0.35 : 0.8} roughness={0.3} />
        </mesh>
      ))}
    </>
  );
}
