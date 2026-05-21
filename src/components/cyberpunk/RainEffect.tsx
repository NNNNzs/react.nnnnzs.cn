/**
 * 窗户雨滴粒子效果
 * 大型落地窗 4.5x3.5，300 雨滴
 */

/* eslint-disable react-hooks/immutability */

'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const RAIN_COUNT = 300;
const WINDOW_WIDTH = 4.5;
const WINDOW_HEIGHT = 3.5;
const WINDOW_POS: [number, number, number] = [0, 1.85, -3.97];

function randomUnit(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export default function RainEffect() {
  const pointsRef = useRef<THREE.Points>(null);
  const resetNonceRef = useRef(0);

  const { positions, velocities, sizes, isStreak } = useMemo(() => {
    const positions = new Float32Array(RAIN_COUNT * 3);
    const velocities = new Float32Array(RAIN_COUNT);
    const sizes = new Float32Array(RAIN_COUNT);
    const isStreak = new Uint8Array(RAIN_COUNT);

    for (let i = 0; i < RAIN_COUNT; i++) {
      positions[i * 3] = (randomUnit(i + 1) - 0.5) * WINDOW_WIDTH;
      positions[i * 3 + 1] = randomUnit(i + 101) * WINDOW_HEIGHT;
      positions[i * 3 + 2] = 0;

      velocities[i] = 0.015 + randomUnit(i + 201) * 0.035;
      sizes[i] = 1 + randomUnit(i + 301) * 2;

      // 20% 的雨滴是流动雨痕
      isStreak[i] = randomUnit(i + 401) > 0.8 ? 1 : 0;
      if (isStreak[i]) {
        velocities[i] *= 1.5; // 雨痕下落更快
        sizes[i] = 1.5 + randomUnit(i + 501) * 1.5;
      }
    }

    return { positions, velocities, sizes, isStreak };
  }, []);

  const rainTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // 竖向细长的雨滴
    const grad = ctx.createLinearGradient(16, 0, 16, 64);
    grad.addColorStop(0, 'rgba(150, 200, 255, 0)');
    grad.addColorStop(0.2, 'rgba(150, 200, 255, 0.4)');
    grad.addColorStop(0.5, 'rgba(180, 220, 255, 0.7)');
    grad.addColorStop(0.8, 'rgba(150, 200, 255, 0.5)');
    grad.addColorStop(1, 'rgba(150, 200, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(16, 32, 3, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    // 高光点
    const hlGrad = ctx.createRadialGradient(14, 26, 0, 14, 26, 6);
    hlGrad.addColorStop(0, 'rgba(220, 240, 255, 0.9)');
    hlGrad.addColorStop(1, 'rgba(200, 230, 255, 0)');
    ctx.fillStyle = hlGrad;
    ctx.fillRect(8, 20, 12, 12);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, []);

  const posAttribute = useMemo(() => new THREE.BufferAttribute(positions, 3), [positions]);
  const sizeAttribute = useMemo(() => new THREE.BufferAttribute(sizes, 1), [sizes]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', posAttribute);
    geo.setAttribute('size', sizeAttribute);
    return geo;
  }, [posAttribute, sizeAttribute]);

  useFrame(() => {
    if (!pointsRef.current) return;

    const posArray = posAttribute.array as Float32Array;
    resetNonceRef.current += 1;

    for (let i = 0; i < RAIN_COUNT; i++) {
      // 向下移动
      posArray[i * 3 + 1] -= velocities[i];

      // 轻微随机横向漂移
      posArray[i * 3] += (randomUnit(i + resetNonceRef.current) - 0.5) * 0.001;

      // 流动雨痕漂移更少（基本直线下落）
      if (isStreak[i]) {
        posArray[i * 3] *= 0.999; // 缓慢回归原位
      }

      // 到底部后重置
      if (posArray[i * 3 + 1] < -WINDOW_HEIGHT / 2) {
        const seed = i + resetNonceRef.current * 17;
        posArray[i * 3] = (randomUnit(seed) - 0.5) * WINDOW_WIDTH;
        posArray[i * 3 + 1] = WINDOW_HEIGHT / 2 + randomUnit(seed + 100) * 0.5;
        velocities[i] = 0.015 + randomUnit(seed + 200) * 0.035;
        if (randomUnit(seed + 300) > 0.8) {
          isStreak[i] = 1;
          velocities[i] *= 1.5;
        } else {
          isStreak[i] = 0;
        }
      }
    }

    posAttribute.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} position={WINDOW_POS} geometry={geometry}>
      <pointsMaterial
        map={rainTexture}
        size={0.05}
        sizeAttenuation={true}
        transparent
        opacity={0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color="#99ccff"
      />
    </points>
  );
}
