'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createScreenTexture, createDataScreenTexture, metalDark } from './shared';
import type { ScreenTextureData } from './types';
import type { HomepageSceneVariant } from '../theme';

export default function MonitorModel({
  position,
  rotation,
  variant,
  sceneVariant,
  screenData,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  variant: number;
  sceneVariant: HomepageSceneVariant;
  screenData?: ScreenTextureData;
}) {
  const texture = useMemo(
    () => screenData ? createDataScreenTexture(screenData) : createScreenTexture(variant),
    [variant, screenData],
  );
  const ref = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const pulse = Math.sin(clock.getElapsedTime() * 0.6 + variant);

    if (ref.current) {
      const material = ref.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 1.1 + pulse * 0.12;
    }

    if (lightRef.current) {
      lightRef.current.intensity = (sceneVariant === 'day' ? 0.18 : 0.55) + pulse * 0.04;
    }
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
      <pointLight
        ref={lightRef}
        position={[0, 0, 0.16]}
        color={sceneVariant === 'day' ? '#89d7ff' : '#00c8ff'}
        intensity={sceneVariant === 'day' ? 0.18 : 0.55}
        distance={sceneVariant === 'day' ? 1.8 : 2.4}
        decay={2}
      />
    </group>
  );
}
