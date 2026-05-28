'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { BlinkingLED, Cable } from './shared';
import { FURNITURE_LAYOUT, ROOM_OBJECTS } from '../sceneLayout';
import { EditableGroup } from '../sceneEditor';

function GlowDisc({
  position,
  scale,
  color,
  intensity,
  variant,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  intensity: number;
  variant: 'day' | 'night';
}) {
  const ringColor = variant === 'day' ? color : '#ffffff';

  const glowTexture = useMemo(() => {
    if (typeof document === 'undefined') {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    const gradient = ctx.createRadialGradient(32, 32, 6, 32, 32, 30);
    gradient.addColorStop(0, `${ringColor}ff`);
    gradient.addColorStop(0.45, `${ringColor}88`);
    gradient.addColorStop(1, `${ringColor}00`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [ringColor]);

  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={scale}>
        <circleGeometry args={[0.56, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={intensity}
          transparent
          opacity={variant === 'day' ? 0.18 : 0.3}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[scale[0] * 1.42, scale[1] * 1.42, scale[2]]}>
        <circleGeometry args={[0.56, 32]} />
        <meshBasicMaterial
          map={glowTexture ?? undefined}
          color={color}
          transparent
          opacity={variant === 'day' ? 0.26 : 0.4}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <pointLight position={[0, -0.06, 0]} color={color} intensity={variant === 'day' ? intensity * 0.42 : intensity * 1.15} distance={variant === 'day' ? 2.8 : 5} decay={2} />
    </group>
  );
}

const CEILING_FIXTURES = ROOM_OBJECTS.ceilingLightBars.slice(0, 3).map((bar, index) => ({
  position: [bar.position[0], bar.position[1] + 0.03, bar.position[2]] as [number, number, number],
  scale: (
    index === 0
      ? [1.18, 0.4, 1]
      : index === 1
        ? [1.05, 0.32, 1]
        : [0.92, 0.24, 1]
  ) as [number, number, number],
  color: (
    bar.style === 'cool-purple'
      ? '#7b61ff'
      : bar.style === 'alert-pink'
        ? '#ff2a9a'
        : '#00f0ff'
  ),
}));

function RobotPet() {
  const layout = FURNITURE_LAYOUT.robotPet;

  return (
    <group position={layout.position} rotation={layout.rotation}>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.18, 0.2, 0.12, 24]} />
        <meshStandardMaterial color="#0d0d15" metalness={0.7} roughness={0.28} />
      </mesh>
      <BlinkingLED position={[0, 0.16, 0.15]} color="#00f0ff" />
    </group>
  );
}

export default function CeilingAndFloorDetails({ variant }: { variant: 'day' | 'night' }) {
  return (
    <EditableGroup id="ceiling-floor-details">
      {CEILING_FIXTURES.map((item, index) => (
        <GlowDisc
          key={index}
          position={item.position}
          scale={item.scale}
          color={item.color}
          intensity={variant === 'day' ? 0.2 : 0.48}
          variant={variant}
        />
      ))}

      <Cable points={[[-2.75, 0.03, -1.68], [-2.05, 0.02, -0.82], [-0.95, 0.025, 0.08], [0.05, 0.02, 0.52]]} />
      <Cable points={[[1.25, 0.03, -2.55], [2.0, 0.02, -2.08], [3.05, 0.025, -1.42]]} radius={0.008} />
      <Cable points={[[-0.55, 0.025, 2.18], [-1.3, 0.02, 2.6], [-2.28, 0.03, 2.62]]} radius={0.009} />
      <RobotPet />
    </EditableGroup>
  );
}
