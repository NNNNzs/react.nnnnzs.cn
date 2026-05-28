'use client';

import { useMemo } from 'react';
import type { HomepageSceneVariant } from '../theme';
import { ROOM, FLOOR_COLOR } from './shared';
import { createFloorTexture } from './textures';
import * as THREE from 'three';

function FloorPlane({
  variant,
  floorTexture,
  floorWidth,
  floorDepth,
}: {
  variant: HomepageSceneVariant;
  floorTexture: THREE.CanvasTexture;
  floorWidth: number;
  floorDepth: number;
}) {
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

export default function FloorSection({ variant }: { variant: HomepageSceneVariant }) {
  const floorTexture = useMemo(() => createFloorTexture(variant), [variant]);
  // 姣旀埧闂村簳闈㈢暐澶т竴鐐癸紝鑳芥妸闀滃ご杈圭紭鐨勭┛甯鎺?
  const floorWidth = ROOM.width + 1.0;
  const floorDepth = ROOM.depth + 3.0;

  return <FloorPlane variant={variant} floorTexture={floorTexture} floorWidth={floorWidth} floorDepth={floorDepth} />;
}
