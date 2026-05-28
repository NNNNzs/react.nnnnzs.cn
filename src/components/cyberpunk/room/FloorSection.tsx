'use client';

import { useMemo } from 'react';
import type { HomepageSceneVariant } from '../theme';
import { ROOM, FLOOR_COLOR } from './shared';
import { createFloorTexture } from './textures';

export default function FloorSection({ variant }: { variant: HomepageSceneVariant }) {
  const floorTexture = useMemo(() => createFloorTexture(variant), [variant]);
  // 比房间底面略大一点，能把镜头边缘的穿帮裁掉
  const floorWidth = ROOM.width + 1.0;
  const floorDepth = ROOM.depth + 3.0;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1.15]} receiveShadow>
      <planeGeometry args={[floorWidth, floorDepth]} />
      <meshStandardMaterial
        map={floorTexture}
        color={variant === 'day' ? '#a47c4f' : FLOOR_COLOR}
        roughness={variant === 'day' ? 0.78 : 0.65}
        metalness={variant === 'day' ? 0.08 : 0.35}
      />
    </mesh>
  );
}
