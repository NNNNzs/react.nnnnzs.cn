'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { HomepageSceneVariant } from '../theme';
import { ROOM, WINDOW } from './shared';
import { createCityTexture } from './textures';

export default function WindowScene({ variant }: { variant: HomepageSceneVariant }) {
  const cityTexture = useMemo(() => createCityTexture(variant), [variant]);
  const windowMeshRef = useRef<THREE.Mesh>(null);
  const hd = ROOM.depth / 2;
  const windowCenterX = WINDOW.centerX ?? 0;
  const windowCenterY = WINDOW.bottomY + WINDOW.height / 2;

  useFrame(() => {
    if (!windowMeshRef.current) return;
    const t = performance.now() * 0.001;
    const mat = windowMeshRef.current.material as THREE.MeshStandardMaterial;
    // 给窗景一点轻微呼吸感，远处城市不会像一张完全静止的海报
    if (mat) mat.emissiveIntensity = variant === 'day' ? 0.12 : 0.5 + Math.sin(t * 0.5) * 0.05;
  });

  return (
    <>
      <mesh position={[windowCenterX, windowCenterY, -hd + 0.02]} ref={windowMeshRef}>
        <planeGeometry args={[WINDOW.width, WINDOW.height]} />
        <meshStandardMaterial
          map={cityTexture}
          emissiveMap={cityTexture}
          emissive={variant === 'day' ? '#fff2d0' : '#445577'}
          emissiveIntensity={variant === 'day' ? 0.12 : 0.5}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[windowCenterX, windowCenterY + WINDOW.height / 2, -hd + 0.03]}>
        <boxGeometry args={[WINDOW.width + 0.1, 0.08, 0.08]} />
        <meshStandardMaterial color={variant === 'day' ? '#d1d5db' : '#1a1a25'} metalness={variant === 'day' ? 0.35 : 0.9} roughness={0.15} />
      </mesh>
      <mesh position={[windowCenterX - WINDOW.width / 2, windowCenterY, -hd + 0.03]}>
        <boxGeometry args={[0.08, WINDOW.height + 0.1, 0.08]} />
        <meshStandardMaterial color={variant === 'day' ? '#d1d5db' : '#1a1a25'} metalness={variant === 'day' ? 0.35 : 0.9} roughness={0.15} />
      </mesh>
      <mesh position={[windowCenterX + WINDOW.width / 2, windowCenterY, -hd + 0.03]}>
        <boxGeometry args={[0.08, WINDOW.height + 0.1, 0.08]} />
        <meshStandardMaterial color={variant === 'day' ? '#d1d5db' : '#1a1a25'} metalness={variant === 'day' ? 0.35 : 0.9} roughness={0.15} />
      </mesh>
      <mesh position={[windowCenterX, WINDOW.bottomY - 0.02, -hd + 0.03]}>
        <boxGeometry args={[WINDOW.width + 0.1, 0.08, 0.08]} />
        <meshStandardMaterial color={variant === 'day' ? '#d1d5db' : '#1a1a25'} metalness={variant === 'day' ? 0.35 : 0.9} roughness={0.15} />
      </mesh>
      {[1, 2].map((i) => (
        <mesh key={`frame-${i}`} position={[windowCenterX - WINDOW.width / 2 + (WINDOW.width / 3) * i, windowCenterY, -hd + 0.03]}>
          <boxGeometry args={[0.04, WINDOW.height, 0.04]} />
          <meshStandardMaterial color={variant === 'day' ? '#d1d5db' : '#1a1a25'} metalness={variant === 'day' ? 0.35 : 0.9} roughness={0.15} />
        </mesh>
      ))}
    </>
  );
}
