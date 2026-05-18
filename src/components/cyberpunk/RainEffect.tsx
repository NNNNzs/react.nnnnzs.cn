/**
 * 窗户雨滴粒子效果
 * 使用 Points 实现雨滴打在玻璃上的效果
 */

'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const RAIN_COUNT = 200;
const WINDOW_WIDTH = 4;
const WINDOW_HEIGHT = 2.5;
const WINDOW_POS: [number, number, number] = [0, 1.8, -2.97];

export default function RainEffect() {
  const pointsRef = useRef<THREE.Points>(null);

  // 初始化雨滴位置和速度
  const { positions, velocities, sizes } = useMemo(() => {
    const positions = new Float32Array(RAIN_COUNT * 3);
    const velocities = new Float32Array(RAIN_COUNT);
    const sizes = new Float32Array(RAIN_COUNT);

    for (let i = 0; i < RAIN_COUNT; i++) {
      // 随机分布在窗户区域
      positions[i * 3] = (Math.random() - 0.5) * WINDOW_WIDTH;
      positions[i * 3 + 1] = Math.random() * WINDOW_HEIGHT;
      positions[i * 3 + 2] = 0; // 贴在窗户表面

      velocities[i] = 0.02 + Math.random() * 0.04; // 下落速度
      sizes[i] = 1 + Math.random() * 2; // 雨滴大小
    }

    return { positions, velocities, sizes };
  }, []);

  // 雨滴纹理
  const rainTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // 竖向细长的雨滴
    const grad = ctx.createLinearGradient(16, 0, 16, 64);
    grad.addColorStop(0, 'rgba(150, 200, 255, 0)');
    grad.addColorStop(0.3, 'rgba(150, 200, 255, 0.6)');
    grad.addColorStop(0.7, 'rgba(150, 200, 255, 0.8)');
    grad.addColorStop(1, 'rgba(150, 200, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(16, 32, 4, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    // 高光
    const hlGrad = ctx.createRadialGradient(14, 28, 0, 14, 28, 8);
    hlGrad.addColorStop(0, 'rgba(200, 230, 255, 0.8)');
    hlGrad.addColorStop(1, 'rgba(200, 230, 255, 0)');
    ctx.fillStyle = hlGrad;
    ctx.fillRect(8, 20, 12, 12);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;

    const posAttr = pointsRef.current.geometry.attributes.position;
    const posArray = posAttr.array as Float32Array;

    for (let i = 0; i < RAIN_COUNT; i++) {
      // 向下移动
      posArray[i * 3 + 1] -= velocities[i];

      // 轻微随机横向漂移
      posArray[i * 3] += (Math.random() - 0.5) * 0.002;

      // 到底部后重置到顶部
      if (posArray[i * 3 + 1] < -WINDOW_HEIGHT / 2) {
        posArray[i * 3] = (Math.random() - 0.5) * WINDOW_WIDTH;
        posArray[i * 3 + 1] = WINDOW_HEIGHT / 2 + Math.random() * 0.5;
        velocities[i] = 0.02 + Math.random() * 0.04;
      }
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} position={WINDOW_POS}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={RAIN_COUNT}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={RAIN_COUNT}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        map={rainTexture}
        size={0.06}
        sizeAttenuation={true}
        transparent
        opacity={0.6}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color="#99ccff"
      />
    </points>
  );
}
