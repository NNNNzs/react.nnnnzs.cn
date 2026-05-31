'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createScreenTexture, createDataScreenTexture, metalDark } from './shared';
import type { ScreenTextureData } from './types';

export default function MonitorModel({
  position,
  rotation,
  variant,
  screenData,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  variant: number;
  screenData?: ScreenTextureData;
}) {
  const texture = useMemo(
    () => screenData ? createDataScreenTexture(screenData) : createScreenTexture(variant),
    [variant, screenData],
  );
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const material = ref.current.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = 1.1 + Math.sin(clock.getElapsedTime() * 0.6 + variant) * 0.12;
  });

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, -0.18, -0.03]}>
        <boxGeometry args={[0.05, 0.28, 0.05]} />
        <meshStandardMaterial {...metalDark} />
      </mesh>
      <mesh position={[0, -0.34, 0.02]}>
        <boxGeometry args={[0.28, 0.03, 0.18]} />
        <meshStandardMaterial {...metalDark} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.8, 0.46, 0.045]} />
        <meshStandardMaterial color="#05050d" metalness={0.75} roughness={0.2} />
      </mesh>
      <mesh ref={ref} position={[0, 0, 0.026]}>
        <planeGeometry args={[0.74, 0.4]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive="#00c8ff"
          emissiveIntensity={1.1}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
