/**
 * 家具组件 - 参考图赛博 Loft primitive 第一版
 *
 * 当前阶段只使用 Three.js 基础几何体搭出空间、构图和家具布局。
 * 后续再按区域逐步替换为 GLB 或自建模型。
 */

'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { HomepageSceneVariant } from './theme';
import { FURNITURE_LAYOUT } from './sceneLayout';

const metalDark = {
  color: '#101018',
  metalness: 0.78,
  roughness: 0.34,
};

const clothDark = {
  color: '#161625',
  metalness: 0.04,
  roughness: 0.92,
};

function createScreenTexture(variant: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#050712';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (variant === 0) {
    ctx.fillStyle = '#07121f';
    ctx.fillRect(18, 16, 604, 328);
    ctx.fillStyle = '#0b0b18';
    ctx.fillRect(18, 16, 110, 328);

    const colors = ['#00f0ff', '#ff2a9a', '#6dffb4', '#ffd166', '#7b61ff'];
    for (let y = 36; y < 328; y += 12) {
      ctx.fillStyle = '#28445d';
      ctx.globalAlpha = 0.42;
      ctx.fillRect(38, y, 42, 5);
      for (let x = 150; x < 585; x += 16 + Math.random() * 26) {
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.globalAlpha = 0.35 + Math.random() * 0.45;
        ctx.fillRect(x, y, 10 + Math.random() * 38, 4);
      }
    }
  } else if (variant === 1) {
    ctx.strokeStyle = '#12314b';
    ctx.lineWidth = 1;
    for (let x = 28; x < 620; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, 22);
      ctx.lineTo(x, 338);
      ctx.stroke();
    }
    for (let y = 22; y < 338; y += 34) {
      ctx.beginPath();
      ctx.moveTo(28, y);
      ctx.lineTo(612, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#00f0ff';
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(320, 180, 92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(320, 180, 42, 0, Math.PI * 2);
    ctx.stroke();

    ['#00f0ff', '#ff2a9a', '#6dffb4'].forEach((color, index) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(52, 58 + index * 56, 170 + index * 40, 10);
      ctx.fillRect(416, 70 + index * 48, 92 + index * 28, 8);
    });
  } else {
    const blocks = [
      ['#00f0ff', 34, 34, 250, 112],
      ['#ff2a9a', 354, 34, 246, 112],
      ['#7b61ff', 34, 196, 250, 112],
      ['#6dffb4', 354, 196, 246, 112],
    ] as const;

    blocks.forEach(([color, x, y, w, h]) => {
      ctx.fillStyle = '#08101c';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.42;
      ctx.fillRect(x + 18, y + 28, w * 0.55, 8);
      ctx.fillRect(x + 18, y + 52, w * 0.34, 8);
      ctx.fillRect(x + 18, y + 76, w * 0.72, 8);
    });
  }

  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function NeonStrip({
  position,
  scale,
  color,
  rotation = [0, 0, 0],
  intensity = 1.4,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  rotation?: [number, number, number];
  intensity?: number;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={scale} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} />
    </mesh>
  );
}

function Cable({
  points,
  radius = 0.01,
  color = '#05050a',
}: {
  points: [number, number, number][];
  radius?: number;
  color?: string;
}) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    return new THREE.TubeGeometry(curve, 16, radius, 6, false);
  }, [points, radius]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

function BlinkingLED({ position, color }: { position: [number, number, number]; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const seed = Math.abs(position[0] * 31 + position[1] * 17 + position[2] * 47 + color.length);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const material = ref.current.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = Math.sin(clock.getElapsedTime() * (1.2 + seed % 2) + seed) > -0.15 ? 1.7 : 0.18;
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.025, 10, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} toneMapped={false} />
    </mesh>
  );
}

function Monitor({
  position,
  rotation,
  variant,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  variant: number;
}) {
  const texture = useMemo(() => createScreenTexture(variant), [variant]);
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

function WorkstationZone() {
  const desk = FURNITURE_LAYOUT.desk;

  return (
    <group>
      <group position={desk.position}>
        <mesh position={[0, 0.78, 0]} castShadow>
          <boxGeometry args={[desk.bounds.width, 0.08, desk.bounds.depth]} />
          <meshStandardMaterial color="#181018" metalness={0.28} roughness={0.72} />
        </mesh>
        <NeonStrip position={[0, 0.74, desk.bounds.depth / 2 + 0.02]} scale={[desk.bounds.width, 0.018, 0.018]} color="#00d8ff" intensity={1.1} />
        {[
          [-1.15, 0.38, -0.34],
          [1.15, 0.38, -0.34],
          [-1.15, 0.38, 0.34],
          [1.15, 0.38, 0.34],
        ].map((pos, index) => (
          <mesh key={index} position={pos as [number, number, number]}>
            <boxGeometry args={[0.06, 0.76, 0.06]} />
            <meshStandardMaterial {...metalDark} />
          </mesh>
        ))}
        <mesh position={[-0.94, 0.34, 0.26]}>
          <boxGeometry args={[0.62, 0.56, 0.38]} />
          <meshStandardMaterial color="#090914" metalness={0.72} roughness={0.26} />
        </mesh>
        {['#00f0ff', '#ff2a9a', '#6dffb4'].map((color, index) => (
          <BlinkingLED key={color} position={[-1.08 + index * 0.13, 0.48, 0.45]} color={color} />
        ))}
      </group>

      {FURNITURE_LAYOUT.monitors.map((monitor) => (
        <Monitor
          key={monitor.variant}
          position={monitor.position}
          rotation={monitor.rotation}
          variant={monitor.variant}
        />
      ))}

      <mesh position={FURNITURE_LAYOUT.keyboard.position} rotation={FURNITURE_LAYOUT.keyboard.rotation}>
        <boxGeometry args={[0.78, 0.035, 0.24]} />
        <meshStandardMaterial color="#070711" metalness={0.4} roughness={0.58} />
      </mesh>
      <NeonStrip position={[-2.18, 0.865, -1.68]} scale={[0.68, 0.008, 0.03]} color="#ff2a9a" intensity={0.8} />
      <mesh position={FURNITURE_LAYOUT.mouse.position}>
        <boxGeometry args={[0.08, 0.035, 0.13]} />
        <meshStandardMaterial color="#080812" emissive="#00f0ff" emissiveIntensity={0.14} />
      </mesh>
      <mesh position={FURNITURE_LAYOUT.coffeeMug.position}>
        <cylinderGeometry args={[0.045, 0.04, 0.1, 14]} />
        <meshStandardMaterial color="#202033" roughness={0.72} />
      </mesh>

      <group position={FURNITURE_LAYOUT.chair.position} rotation={FURNITURE_LAYOUT.chair.rotation}>
        <mesh position={[0, 0.48, 0]}>
          <boxGeometry args={[0.58, 0.1, 0.55]} />
          <meshStandardMaterial {...clothDark} />
        </mesh>
        <mesh position={[0, 0.92, -0.2]} rotation={[-0.18, 0, 0]}>
          <boxGeometry args={[0.58, 0.82, 0.09]} />
          <meshStandardMaterial color="#111122" roughness={0.86} />
        </mesh>
        <NeonStrip position={[0.31, 0.92, -0.145]} scale={[0.025, 0.68, 0.02]} color="#ff2a9a" intensity={0.9} />
        <NeonStrip position={[-0.31, 0.92, -0.145]} scale={[0.025, 0.68, 0.02]} color="#00d8ff" intensity={0.75} />
        <mesh position={[0, 0.24, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.36, 10]} />
          <meshStandardMaterial {...metalDark} />
        </mesh>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.26, 0.29, 0.04, 18]} />
          <meshStandardMaterial {...metalDark} />
        </mesh>
      </group>

      <group position={FURNITURE_LAYOUT.glowPlant.position}>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.12, 0.1, 0.28, 12]} />
          <meshStandardMaterial color="#151521" roughness={0.8} />
        </mesh>
        {[0, 1, 2, 3, 4].map((index) => (
          <mesh
            key={index}
            position={[
              Math.cos(index * 1.26) * 0.13,
              0.45 + Math.sin(index) * 0.08,
              Math.sin(index * 1.26) * 0.13,
            ]}
          >
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color="#37ff9a" emissive="#37ff9a" emissiveIntensity={0.5} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

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

function StorageWallZone() {
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

function HologramCore({ variant }: { variant: HomepageSceneVariant }) {
  const ref = useRef<THREE.Group>(null);
  const color = variant === 'day' ? '#0ea5e9' : '#ff2a9a';

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 0.9 + Math.sin(clock.getElapsedTime() * 1.1) * 0.045;
    ref.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.3) * 0.08;
  });

  return (
    <group ref={ref} position={[0, 0.9, 0]}>
      <mesh>
        <boxGeometry args={[0.52, 0.58, 0.035]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.65} transparent opacity={0.34} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.39, 36]} />
        <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={0.75} transparent opacity={0.45} toneMapped={false} />
      </mesh>
      <Text position={[0, 0, 0.03]} fontSize={0.08} anchorX="center" anchorY="middle" color="#ffffff">
        POSTS
      </Text>
    </group>
  );
}

function LivingCoreZone({ variant }: { variant: HomepageSceneVariant }) {
  const table = FURNITURE_LAYOUT.coffeeTable;
  const sofa = FURNITURE_LAYOUT.sofa;

  return (
    <group>
      <mesh position={[-0.08, 0.012, 0.72]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 1.55]} />
        <meshStandardMaterial color="#111122" roughness={0.86} metalness={0.12} />
      </mesh>
      <NeonStrip position={[-0.08, 0.03, -0.03]} scale={[2.6, 0.018, 0.018]} color="#00d8ff" intensity={0.42} />
      <NeonStrip position={[-0.08, 0.03, 1.47]} scale={[2.6, 0.018, 0.018]} color="#ff2a9a" intensity={0.42} />

      <group position={table.position}>
        <mesh position={[0, 0.38, 0]}>
          <boxGeometry args={[table.bounds.width, 0.08, table.bounds.depth]} />
          <meshStandardMaterial color="#101018" metalness={0.5} roughness={0.28} transparent opacity={0.78} />
        </mesh>
        {[
          [-0.75, 0.18, -0.32],
          [0.75, 0.18, -0.32],
          [-0.75, 0.18, 0.32],
          [0.75, 0.18, 0.32],
        ].map((pos, index) => (
          <mesh key={index} position={pos as [number, number, number]}>
            <boxGeometry args={[0.05, 0.36, 0.05]} />
            <meshStandardMaterial {...metalDark} />
          </mesh>
        ))}
        <HologramCore variant={variant} />
        <mesh position={[-0.55, 0.45, 0.2]}>
          <cylinderGeometry args={[0.04, 0.035, 0.16, 14]} />
          <meshStandardMaterial color="#181827" roughness={0.7} />
        </mesh>
        <mesh position={[0.6, 0.48, -0.12]}>
          <cylinderGeometry args={[0.035, 0.032, 0.22, 12]} />
          <meshStandardMaterial color="#231026" emissive="#ff2a9a" emissiveIntensity={0.08} />
        </mesh>
      </group>

      <group position={sofa.position} rotation={sofa.rotation}>
        <mesh position={[0, 0.38, 0]}>
          <boxGeometry args={[sofa.bounds.width, 0.46, sofa.bounds.depth]} />
          <meshStandardMaterial color="#11111b" roughness={0.92} />
        </mesh>
        <mesh position={[0, 0.78, -0.28]}>
          <boxGeometry args={[sofa.bounds.width, 0.7, 0.18]} />
          <meshStandardMaterial color="#0d0d16" roughness={0.9} />
        </mesh>
        {[-0.68, 0, 0.68].map((x) => (
          <mesh key={x} position={[x, 0.65, 0.02]} rotation={[0.05, 0, 0]}>
            <boxGeometry args={[0.55, 0.16, 0.45]} />
            <meshStandardMaterial color="#151521" roughness={0.96} />
          </mesh>
        ))}
        <NeonStrip position={[0, 0.16, 0.37]} scale={[2.18, 0.035, 0.03]} color="#ff2a9a" intensity={1.2} />
      </group>
    </group>
  );
}

function SleepZone() {
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

function WardrobeZone() {
  const layout = FURNITURE_LAYOUT.wardrobe;

  return (
    <group position={layout.position} rotation={layout.rotation}>
      <mesh position={[0, 1.15, -0.22]}>
        <boxGeometry args={[layout.bounds.width, layout.bounds.height, 0.08]} />
        <meshStandardMaterial color="#0b0b14" metalness={0.48} roughness={0.44} />
      </mesh>
      <mesh position={[0, 2.15, 0]}>
        <boxGeometry args={[1.08, 0.04, 0.42]} />
        <meshStandardMaterial {...metalDark} />
      </mesh>
      <mesh position={[0, 1.72, 0.15]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 1.04, 10]} />
        <meshStandardMaterial {...metalDark} />
      </mesh>
      {[-0.36, -0.12, 0.14, 0.38].map((x, index) => (
        <mesh key={x} position={[x, 1.28, 0.12]} rotation={[0, 0, (index % 2 ? -0.03 : 0.03)]}>
          <boxGeometry args={[0.18, 0.82, 0.08]} />
          <meshStandardMaterial color={index % 2 ? '#171725' : '#26112c'} roughness={0.94} />
        </mesh>
      ))}
      <NeonStrip position={[0, 0.72, 0.27]} scale={[1.06, 0.035, 0.03]} color="#ff2a9a" intensity={1.1} />
      <NeonStrip position={[0.62, 1.45, 0.03]} scale={[0.025, 1.35, 0.025]} color="#7b61ff" intensity={1.0} />
    </group>
  );
}

function CeilingAndFloorDetails({ variant }: { variant: HomepageSceneVariant }) {
  return (
    <group>
      {[
        { position: [-1.85, 0.014, 0.02] as [number, number, number], scale: [1.18, 0.4, 1] as [number, number, number], color: '#00f0ff' },
        { position: [1.05, 0.015, 0.9] as [number, number, number], scale: [1.05, 0.32, 1] as [number, number, number], color: '#ff2a9a' },
        { position: [2.25, 0.016, 0.18] as [number, number, number], scale: [0.92, 0.24, 1] as [number, number, number], color: '#7b61ff' },
      ].map((item, index) => (
        <mesh key={index} position={item.position} rotation={[-Math.PI / 2, 0, index * 0.32]} scale={item.scale}>
          <circleGeometry args={[0.56, 32]} />
          <meshStandardMaterial
            color={item.color}
            emissive={item.color}
            emissiveIntensity={variant === 'day' ? 0.08 : 0.22}
            transparent
            opacity={variant === 'day' ? 0.08 : 0.16}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      <Cable points={[[-2.75, 0.03, -1.68], [-2.05, 0.02, -0.82], [-0.95, 0.025, 0.08], [0.05, 0.02, 0.52]]} />
      <Cable points={[[1.25, 0.03, -2.55], [2.0, 0.02, -2.08], [3.05, 0.025, -1.42]]} radius={0.008} />
      <Cable points={[[-0.55, 0.025, 2.18], [-1.3, 0.02, 2.6], [-2.28, 0.03, 2.62]]} radius={0.009} />

      <group position={FURNITURE_LAYOUT.robotPet.position} rotation={FURNITURE_LAYOUT.robotPet.rotation}>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.18, 0.2, 0.12, 24]} />
          <meshStandardMaterial color="#0d0d15" metalness={0.7} roughness={0.28} />
        </mesh>
        <BlinkingLED position={[0, 0.16, 0.15]} color="#00f0ff" />
      </group>
    </group>
  );
}

function NeonSign({ variant }: { variant: HomepageSceneVariant }) {
  const layout = FURNITURE_LAYOUT.neonSign;
  const isDay = variant === 'day';

  return (
    <group position={layout.position} rotation={layout.rotation}>
      <mesh>
        <planeGeometry args={[1.4, 0.55]} />
        <meshStandardMaterial
          color={isDay ? '#f8fafc' : '#160617'}
          emissive={isDay ? '#38bdf8' : '#ff2a9a'}
          emissiveIntensity={isDay ? 0.08 : 0.58}
          transparent
          opacity={0.82}
          toneMapped={false}
        />
      </mesh>
      <Text position={[0, 0.03, 0.02]} fontSize={0.18} anchorX="center" anchorY="middle" color={isDay ? '#0f172a' : '#ffd8f2'}>
        NO
      </Text>
      <Text position={[0, -0.18, 0.02]} fontSize={0.12} anchorX="center" anchorY="middle" color={isDay ? '#0f172a' : '#ffd8f2'}>
        FUTURE
      </Text>
    </group>
  );
}

export default function Furniture({ variant = 'night' }: { variant?: HomepageSceneVariant }) {
  return (
    <group>
      <WorkstationZone />
      <StorageWallZone />
      <LivingCoreZone variant={variant} />
      <SleepZone />
      <WardrobeZone />
      <CeilingAndFloorDetails variant={variant} />
      <NeonSign variant={variant} />
    </group>
  );
}
