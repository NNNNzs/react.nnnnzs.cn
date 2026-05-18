/**
 * 赛博朋克灯光系统
 * - 主环境光（低亮度深蓝）
 * - 窗外冷色光（模拟城市霓虹穿透）
 * - 点光源：霓虹青、霓虹粉、霓虹绿
 */

'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function CyberpunkLights() {
  const cyanLight = useRef<THREE.PointLight>(null);
  const pinkLight = useRef<THREE.PointLight>(null);
  const greenLight = useRef<THREE.PointLight>(null);

  // 微弱的灯光呼吸效果
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (cyanLight.current) {
      cyanLight.current.intensity = 3 + Math.sin(t * 1.5) * 0.3;
    }
    if (pinkLight.current) {
      pinkLight.current.intensity = 2 + Math.sin(t * 0.8 + 1) * 0.4;
    }
    if (greenLight.current) {
      greenLight.current.intensity = 1.5 + Math.sin(t * 2 + 2) * 0.2;
    }
  });

  return (
    <>
      {/* 环境光 - 深蓝底色 */}
      <ambientLight intensity={0.08} color="#1a1a3e" />

      {/* 窗外主光源 - 冷白偏蓝 */}
      <directionalLight
        position={[0, 3, -4]}
        intensity={0.3}
        color="#8899cc"
        castShadow={false}
      />

      {/* 霓虹青光 - 桌面区域 */}
      <pointLight
        ref={cyanLight}
        position={[1, 1.5, 0]}
        intensity={3}
        color="#00f0ff"
        distance={6}
        decay={2}
      />

      {/* 霓虹粉光 - 床/左侧 */}
      <pointLight
        ref={pinkLight}
        position={[-3, 1.8, -1]}
        intensity={2}
        color="#ff0066"
        distance={5}
        decay={2}
      />

      {/* 霓虹绿光 - 服务器区/右下 */}
      <pointLight
        ref={greenLight}
        position={[3, 0.5, -2]}
        intensity={1.5}
        color="#00ff88"
        distance={4}
        decay={2}
      />

      {/* 窗外城市反射光 */}
      <spotLight
        position={[0, 3.5, -5]}
        angle={0.6}
        penumbra={0.8}
        intensity={0.5}
        color="#4466aa"
      />
    </>
  );
}
