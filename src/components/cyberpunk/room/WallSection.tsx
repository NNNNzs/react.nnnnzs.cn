'use client';

import { useMemo } from 'react';
import type { HomepageSceneVariant } from '../theme';
import { ROOM, WALL_COLOR } from './shared';
import { createWallTexture } from './textures';

export default function WallSection({ variant }: { variant: HomepageSceneVariant }) {
  const wallTexture = useMemo(() => createWallTexture(variant), [variant]);
  // 只画背墙和左右墙，前侧保留开口，方便镜头观察内部
  const hw = ROOM.width / 2;
  const hh = ROOM.height;
  const hd = ROOM.depth / 2;

  return (
    <>
      <mesh position={[0, hh / 2, -hd]}>
        <planeGeometry args={[ROOM.width, hh]} />
        <meshStandardMaterial map={wallTexture} color={variant === 'day' ? '#eef4f8' : WALL_COLOR} roughness={0.92} />
      </mesh>

      <mesh position={[-hw, hh / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM.depth, hh]} />
        <meshStandardMaterial map={wallTexture} color={variant === 'day' ? '#eef4f8' : WALL_COLOR} roughness={0.92} />
      </mesh>

      <mesh position={[hw, hh / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM.depth, hh]} />
        <meshStandardMaterial map={wallTexture} color={variant === 'day' ? '#eef4f8' : WALL_COLOR} roughness={0.92} />
      </mesh>
    </>
  );
}
