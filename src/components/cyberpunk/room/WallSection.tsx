'use client';

import { useMemo } from 'react';
import type { HomepageSceneVariant } from '../theme';
import { ROOM, WALL_COLOR } from './shared';
import { createWallTexture } from './textures';
import type * as THREE from 'three';

function BackWall({ variant, wallTexture, hh, hd }: {
  variant: HomepageSceneVariant;
  wallTexture: THREE.CanvasTexture;
  hh: number;
  hd: number;
}) {
  return (
    <mesh position={[0, hh / 2, -hd]}>
      <planeGeometry args={[ROOM.width, hh]} />
      <meshStandardMaterial
        map={wallTexture}
        color={variant === 'day' ? '#eef4f8' : WALL_COLOR}
        roughness={0.92}
      />
    </mesh>
  );
}

function LeftWall({ variant, wallTexture, hh, hw }: {
  variant: HomepageSceneVariant;
  wallTexture: THREE.CanvasTexture;
  hh: number;
  hw: number;
}) {
  return (
    <mesh position={[-hw, hh / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[ROOM.depth, hh]} />
      <meshStandardMaterial
        map={wallTexture}
        color={variant === 'day' ? '#eef4f8' : WALL_COLOR}
        roughness={0.92}
      />
    </mesh>
  );
}

function RightWall({ variant, wallTexture, hh, hw }: {
  variant: HomepageSceneVariant;
  wallTexture: THREE.CanvasTexture;
  hh: number;
  hw: number;
}) {
  return (
    <mesh position={[hw, hh / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
      <planeGeometry args={[ROOM.depth, hh]} />
      <meshStandardMaterial
        map={wallTexture}
        color={variant === 'day' ? '#eef4f8' : WALL_COLOR}
        roughness={0.92}
      />
    </mesh>
  );
}

export default function WallSection({ variant }: { variant: HomepageSceneVariant }) {
  const wallTexture = useMemo(() => createWallTexture(variant), [variant]);
  // 鍙敾鑳屽鍜屽乏鍙冲锛屽墠渚т繚鐣欏紑鍙ｏ紝鏂逛究闀滃ご瑙傚療鍐呴儴
  const hw = ROOM.width / 2;
  const hh = ROOM.height;
  const hd = ROOM.depth / 2;

  return (
    <>
      <BackWall variant={variant} wallTexture={wallTexture} hh={hh} hd={hd} />
      <LeftWall variant={variant} wallTexture={wallTexture} hh={hh} hw={hw} />
      <RightWall variant={variant} wallTexture={wallTexture} hh={hh} hw={hw} />
    </>
  );
}
