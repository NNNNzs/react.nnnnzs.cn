'use client';

import { useMemo } from 'react';
import type { HomepageSceneVariant } from '../theme';
import { ROOM, WALL_COLOR } from './shared';
import { createWallTextures, type WallTexturesSet } from './textures';

function BackWall({ variant, textures, hh, hd }: {
  variant: HomepageSceneVariant;
  textures: WallTexturesSet['back'];
  hh: number;
  hd: number;
}) {
  return (
    <mesh position={[0, hh / 2, -hd]}>
      <planeGeometry args={[ROOM.width, hh]} />
      <meshStandardMaterial
        map={textures.color}
        roughnessMap={textures.roughness}
        color={variant === 'day' ? '#eef4f8' : WALL_COLOR}
        roughness={0.88}
      />
    </mesh>
  );
}

function LeftWall({ variant, textures, hh, hw }: {
  variant: HomepageSceneVariant;
  textures: WallTexturesSet['left'];
  hh: number;
  hw: number;
}) {
  return (
    <mesh position={[-hw, hh / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[ROOM.depth, hh]} />
      <meshStandardMaterial
        map={textures.color}
        roughnessMap={textures.roughness}
        color={variant === 'day' ? '#eef4f8' : WALL_COLOR}
        roughness={0.88}
      />
    </mesh>
  );
}

function RightWall({ variant, textures, hh, hw }: {
  variant: HomepageSceneVariant;
  textures: WallTexturesSet['right'];
  hh: number;
  hw: number;
}) {
  return (
    <mesh position={[hw, hh / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
      <planeGeometry args={[ROOM.depth, hh]} />
      <meshStandardMaterial
        map={textures.color}
        roughnessMap={textures.roughness}
        color={variant === 'day' ? '#eef4f8' : WALL_COLOR}
        roughness={0.88}
      />
    </mesh>
  );
}

export default function WallSection({ variant }: { variant: HomepageSceneVariant }) {
  const textures = useMemo(() => createWallTextures(variant), [variant]);
  // 只画背景墙和左右墙，前侧保留开口，方便镜头观察内部
  const hw = ROOM.width / 2;
  const hh = ROOM.height;
  const hd = ROOM.depth / 2;

  return (
    <>
      <BackWall variant={variant} textures={textures.back} hh={hh} hd={hd} />
      <LeftWall variant={variant} textures={textures.left} hh={hh} hw={hw} />
      <RightWall variant={variant} textures={textures.right} hh={hh} hw={hw} />
    </>
  );
}
