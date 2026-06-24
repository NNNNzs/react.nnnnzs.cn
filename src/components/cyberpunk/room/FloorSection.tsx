'use client';

import { useMemo } from 'react';
import type { HomepageSceneVariant } from '../theme';
import { HOMEPAGE_THEME_PRESETS } from '../theme';
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
  const scenePreset = HOMEPAGE_THEME_PRESETS[variant].scene;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1.15]} receiveShadow>
      <planeGeometry args={[floorWidth, floorDepth]} />
      <meshStandardMaterial
        map={floorTexture}
        color={variant === 'day' ? scenePreset.floorColor : FLOOR_COLOR}
        roughness={scenePreset.floorRoughness}
        metalness={scenePreset.floorMetalness}
      />
    </mesh>
  );
}

export default function FloorSection({ variant }: { variant: HomepageSceneVariant }) {
  const floorTexture = useMemo(() => createFloorTexture(variant), [variant]);
  // 地面略大于房间底面，遮住默认镜头边缘可能露出的空隙。
  const floorWidth = ROOM.width + 1.0;
  const floorDepth = ROOM.depth + 3.0;

  return <FloorPlane variant={variant} floorTexture={floorTexture} floorWidth={floorWidth} floorDepth={floorDepth} />;
}
