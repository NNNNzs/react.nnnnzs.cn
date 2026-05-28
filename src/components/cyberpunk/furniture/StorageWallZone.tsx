'use client';

import { Text } from '@react-three/drei';
import { BlinkingLED, NeonStrip, metalDark } from './shared';
import { FURNITURE_LAYOUT } from '../sceneLayout';

function Bookshelf() {
  const layout = FURNITURE_LAYOUT.bookshelf;

  return (
    <group position={layout.position} rotation={layout.rotation}>
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[layout.bounds.width, layout.bounds.height, 0.08]} />
        <meshStandardMaterial color="#0c0c15" metalness={0.5} roughness={0.44} />
      </mesh>
      {[-0.62, 0, 0.62].map((x) => (
        <mesh key={x} position={[x, 1.35, 0.23]}>
          <boxGeometry args={[0.04, layout.bounds.height, 0.38]} />
          <meshStandardMaterial {...metalDark} />
        </mesh>
      ))}
      {[0.35, 0.82, 1.29, 1.76, 2.23, 2.7].map((y) => (
        <mesh key={y} position={[0, y, 0.24]}>
          <boxGeometry args={[layout.bounds.width, 0.04, 0.42]} />
          <meshStandardMaterial {...metalDark} />
        </mesh>
      ))}
      {Array.from({ length: 34 }).map((_, index) => {
        const col = index % 11;
        const row = Math.floor(index / 11);
        const x = -0.54 + col * 0.11;
        const y = 0.48 + row * 0.47;
        const h = 0.2 + ((index * 7) % 8) * 0.018;
        const color = ['#202038', '#29223d', '#1d2840', '#24322c'][index % 4];

        return (
          <mesh key={index} position={[x, y + h / 2, 0.48]}>
            <boxGeometry args={[0.065, h, 0.16]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
        );
      })}
      {['#00f0ff', '#ff2a9a', '#7b61ff', '#6dffb4'].map((color, index) => (
        <mesh key={color} position={[-0.42 + index * 0.28, 2.38, 0.5]}>
          <boxGeometry args={[0.08, 0.28, 0.16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.46} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function ServerRack() {
  const layout = FURNITURE_LAYOUT.serverRack;
  const colors = ['#00f0ff', '#6dffb4', '#ff2a9a', '#7b61ff'];

  return (
    <group position={layout.position} rotation={layout.rotation}>
      <mesh position={[0, 0.98, 0]}>
        <boxGeometry args={[layout.bounds.width, layout.bounds.height, layout.bounds.depth]} />
        <meshStandardMaterial color="#080812" metalness={0.86} roughness={0.24} />
      </mesh>
      {[0.28, 0.58, 0.88, 1.18, 1.48, 1.78].map((y, row) => (
        <group key={y} position={[0, y, 0.255]}>
          <mesh>
            <boxGeometry args={[0.52, 0.08, 0.03]} />
            <meshStandardMaterial color="#151525" metalness={0.7} roughness={0.3} />
          </mesh>
          {[0, 1, 2, 3].map((col) => (
            <BlinkingLED key={col} position={[-0.2 + col * 0.12, 0, 0.03]} color={colors[(row + col) % colors.length]} />
          ))}
        </group>
      ))}
      <NeonStrip position={[0.35, 1.0, 0.03]} scale={[0.022, 1.75, 0.025]} color="#00d8ff" intensity={1.2} />
    </group>
  );
}

export default function StorageWallZone() {
  return (
    <group>
      <Bookshelf />
      <ServerRack />

      <group position={[3.56, 1.58, -3.03]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh>
          <planeGeometry args={[0.72, 1.0]} />
          <meshStandardMaterial color="#0b0714" emissive="#7b61ff" emissiveIntensity={0.28} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <ringGeometry args={[0.22, 0.28, 32]} />
          <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={1.2} toneMapped={false} transparent opacity={0.8} />
        </mesh>
        <Text position={[0, -0.42, 0.02]} fontSize={0.08} anchorX="center" anchorY="middle" color="#ffb9ea">
          DATA GHOST
        </Text>
      </group>

      <group position={[3.55, 1.38, -0.48]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh>
          <planeGeometry args={[1.15, 0.72]} />
          <meshStandardMaterial color="#050712" emissive="#ff2a9a" emissiveIntensity={0.14} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <ringGeometry args={[0.16, 0.19, 36]} />
          <meshStandardMaterial color="#ff2a9a" emissive="#ff2a9a" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
        <Text position={[0, -0.25, 0.025]} fontSize={0.075} anchorX="center" anchorY="middle" color="#7ee7ff">
          KIROSHI INDEX
        </Text>
      </group>
    </group>
  );
}
