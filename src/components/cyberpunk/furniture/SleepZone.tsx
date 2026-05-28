'use client';

import { BlinkingLED, NeonStrip, metalDark } from './shared';
import { FURNITURE_LAYOUT } from '../sceneLayout';

export default function SleepZone() {
  const bed = FURNITURE_LAYOUT.bed;

  return (
    <group>
      <group position={bed.position}>
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[bed.bounds.width, 0.22, bed.bounds.depth]} />
          <meshStandardMaterial color="#0c0c14" metalness={0.22} roughness={0.74} />
        </mesh>
        <mesh position={[0, 0.39, 0]}>
          <boxGeometry args={[2.0, 0.2, 1.18]} />
          <meshStandardMaterial color="#171725" roughness={0.96} />
        </mesh>
        <mesh position={[0.05, 0.55, 0.12]} rotation={[0.02, -0.06, 0.02]}>
          <boxGeometry args={[1.8, 0.18, 0.82]} />
          <meshStandardMaterial color="#11111f" roughness={0.98} />
        </mesh>
        <mesh position={[-0.58, 0.62, -0.42]}>
          <boxGeometry args={[0.5, 0.13, 0.28]} />
          <meshStandardMaterial color="#202033" roughness={0.96} />
        </mesh>
        <mesh position={[0.12, 0.61, -0.45]}>
          <boxGeometry args={[0.48, 0.12, 0.28]} />
          <meshStandardMaterial color="#1b1b2d" roughness={0.96} />
        </mesh>
        <NeonStrip position={[0, 0.16, 0.72]} scale={[2.02, 0.035, 0.035]} color="#ff2a9a" intensity={1.35} />
      </group>

      <group position={FURNITURE_LAYOUT.nightstand.position}>
        <mesh position={[0, 0.28, 0]}>
          <boxGeometry args={[0.48, 0.55, 0.4]} />
          <meshStandardMaterial {...metalDark} />
        </mesh>
        <BlinkingLED position={[0.16, 0.48, 0.22]} color="#00f0ff" />
      </group>

      <group position={FURNITURE_LAYOUT.neonPoster.position} rotation={FURNITURE_LAYOUT.neonPoster.rotation}>
        <mesh>
          <planeGeometry args={[0.78, 0.78]} />
          <meshStandardMaterial color="#050712" emissive="#00f0ff" emissiveIntensity={0.16} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.015]}>
          <ringGeometry args={[0.24, 0.3, 40]} />
          <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
