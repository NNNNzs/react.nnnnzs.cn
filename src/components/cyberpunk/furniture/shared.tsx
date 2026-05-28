'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const metalDark = {
  color: '#101018',
  metalness: 0.78,
  roughness: 0.34,
} as const;

export const clothDark = {
  color: '#161625',
  metalness: 0.04,
  roughness: 0.92,
} as const;

// 屏幕贴图抽成独立生成器，减少各家具组件里的重复绘制逻辑
export function createScreenTexture(variant: number): THREE.CanvasTexture {
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

export function NeonStrip({
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
      {/* 霓虹灯条本身就是“可见灯具”，不是单独悬空补一个光源就完事 */}
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} />
    </mesh>
  );
}

export function Cable({
  points,
  radius = 0.01,
  color = '#05050a',
}: {
  points: [number, number, number][];
  radius?: number;
  color?: string;
}) {
  const geometry = useMemo(() => {
    // 线缆用样条管做出自然弯折，不会像直线拉线那样生硬
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    return new THREE.TubeGeometry(curve, 16, radius, 6, false);
  }, [points, radius]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

export function BlinkingLED({ position, color }: { position: [number, number, number]; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const seed = Math.abs(position[0] * 31 + position[1] * 17 + position[2] * 47 + color.length);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const material = ref.current.material as THREE.MeshStandardMaterial;
    // 通过种子控制闪烁节奏，让每个 LED 看起来都“有自己的脾气”
    material.emissiveIntensity = Math.sin(clock.getElapsedTime() * (1.2 + seed % 2) + seed) > -0.15 ? 1.7 : 0.18;
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.025, 10, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} toneMapped={false} />
    </mesh>
  );
}
