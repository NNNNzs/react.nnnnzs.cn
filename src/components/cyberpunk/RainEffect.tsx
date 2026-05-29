/**
 * 窗户雨滴粒子效果
 * 大型落地窗 4.5x3.5，支持动态 count 和 enabled 控制
 */

/* eslint-disable react-hooks/immutability */

'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const DEFAULT_COUNT = 120;
const WINDOW_WIDTH = 4.5;
const WINDOW_HEIGHT = 3.5;
const WINDOW_POS: [number, number, number] = [0, 1.85, -3.97];

function randomUnit(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export default function RainEffect({ count = DEFAULT_COUNT, enabled = true }: { count?: number; enabled?: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const resetNonceRef = useRef(0);
  const frameCountRef = useRef(0);

  const { velocities, isStreak, posAttribute, geometry } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    const sizes = new Float32Array(count);
    const isStreak = new Uint8Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (randomUnit(i + 1) - 0.5) * WINDOW_WIDTH;
      positions[i * 3 + 1] = randomUnit(i + 101) * WINDOW_HEIGHT;
      positions[i * 3 + 2] = 0;

      velocities[i] = 0.015 + randomUnit(i + 201) * 0.035;
      sizes[i] = 1 + randomUnit(i + 301) * 2;

      isStreak[i] = randomUnit(i + 401) > 0.8 ? 1 : 0;
      if (isStreak[i]) {
        velocities[i] *= 1.5;
        sizes[i] = 1.5 + randomUnit(i + 501) * 1.5;
      }
    }

    const posAttribute = new THREE.BufferAttribute(positions, 3);
    const sizeAttribute = new THREE.BufferAttribute(sizes, 1);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', posAttribute);
    geo.setAttribute('size', sizeAttribute);

    return { velocities, isStreak, posAttribute, geometry: geo };
  }, [count]);

  const rainTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

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

    const hlGrad = ctx.createRadialGradient(14, 26, 0, 14, 26, 6);
    hlGrad.addColorStop(0, 'rgba(220, 240, 255, 0.9)');
    hlGrad.addColorStop(1, 'rgba(200, 230, 255, 0)');
    ctx.fillStyle = hlGrad;
    ctx.fillRect(8, 20, 12, 12);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, []);

  useEffect(() => {
    if (pointsRef.current) {
      pointsRef.current.visible = enabled;
    }
  }, [enabled]);

  useFrame(() => {
    if (!pointsRef.current || !enabled) return;

    frameCountRef.current += 1;
    const posArray = posAttribute.array as Float32Array;
    const skipDrift = frameCountRef.current % 3 !== 0;

    resetNonceRef.current += 1;
    const nonce = resetNonceRef.current;

    for (let i = 0; i < count; i++) {
      posArray[i * 3 + 1] -= velocities[i];

      if (!skipDrift) {
        posArray[i * 3] += (randomUnit(i + nonce) - 0.5) * 0.001;
      }

      if (isStreak[i]) {
        posArray[i * 3] *= 0.999;
      }

      if (posArray[i * 3 + 1] < -WINDOW_HEIGHT / 2) {
        const seed = i + nonce * 17;
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
