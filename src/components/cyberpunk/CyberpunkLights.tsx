/**
 * 赛博朋克灯光系统 - 以窗外城市霓虹光为主要光源
 * 所有参数从 Zustand store 读取
 */

'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore, PRODUCTION_DEFAULTS } from './useSceneStore';
import type { HomepageSceneVariant } from './theme';

const PD = PRODUCTION_DEFAULTS.lights;
const isDev = process.env.NODE_ENV === 'development';

export default function CyberpunkLights({ variant = 'night' }: { variant?: HomepageSceneVariant }) {
  const windowLight = useRef<THREE.SpotLight>(null);
  const monitorLight = useRef<THREE.PointLight>(null);
  const serverLight = useRef<THREE.PointLight>(null);
  const neonSignLight = useRef<THREE.PointLight>(null);
  const ceilingCyanLight = useRef<THREE.PointLight>(null);
  const ceilingPurpleLight = useRef<THREE.PointLight>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ambientLightRef = useRef<any>(null);

  // Zustand selector 订阅（只在对应值变化时重渲染）
  const ambientIntensity = useSceneStore(st => st.lights.ambientIntensity);
  const ambientColor = useSceneStore(st => st.lights.ambientColor);
  const windowIntensity = useSceneStore(st => st.lights.windowIntensity);
  const windowColor = useSceneStore(st => st.lights.windowColor);
  const windowAngle = useSceneStore(st => st.lights.windowAngle);
  const windowPenumbra = useSceneStore(st => st.lights.windowPenumbra);
  const windowDecay = useSceneStore(st => st.lights.windowDecay);
  const monitorIntensity = useSceneStore(st => st.lights.monitorIntensity);
  const monitorColor = useSceneStore(st => st.lights.monitorColor);
  const monitorDistance = useSceneStore(st => st.lights.monitorDistance);
  const monitorDecay = useSceneStore(st => st.lights.monitorDecay);
  const serverIntensity = useSceneStore(st => st.lights.serverIntensity);
  const serverColor = useSceneStore(st => st.lights.serverColor);
  const serverDistance = useSceneStore(st => st.lights.serverDistance);
  const serverDecay = useSceneStore(st => st.lights.serverDecay);
  const neonSignIntensity = useSceneStore(st => st.lights.neonSignIntensity);
  const neonSignColor = useSceneStore(st => st.lights.neonSignColor);
  const neonSignDistance = useSceneStore(st => st.lights.neonSignDistance);
  const neonSignDecay = useSceneStore(st => st.lights.neonSignDecay);
  const ceilingCyanIntensity = useSceneStore(st => st.lights.ceilingCyanIntensity);
  const ceilingCyanColor = useSceneStore(st => st.lights.ceilingCyanColor);
  const ceilingCyanDistance = useSceneStore(st => st.lights.ceilingCyanDistance);
  const ceilingCyanDecay = useSceneStore(st => st.lights.ceilingCyanDecay);
  const ceilingPurpleIntensity = useSceneStore(st => st.lights.ceilingPurpleIntensity);
  const ceilingPurpleColor = useSceneStore(st => st.lights.ceilingPurpleColor);
  const ceilingPurpleDistance = useSceneStore(st => st.lights.ceilingPurpleDistance);
  const ceilingPurpleDecay = useSceneStore(st => st.lights.ceilingPurpleDecay);

  // 当前生效值：开发环境用 selector 值，生产环境用默认常量
  const nightValues = isDev
    ? { ambientIntensity, ambientColor, windowIntensity, windowColor, windowAngle, windowPenumbra, windowDecay,
        monitorIntensity, monitorColor, monitorDistance, monitorDecay,
        serverIntensity, serverColor, serverDistance, serverDecay,
        neonSignIntensity, neonSignColor, neonSignDistance, neonSignDecay,
        ceilingCyanIntensity, ceilingCyanColor, ceilingCyanDistance, ceilingCyanDecay,
        ceilingPurpleIntensity, ceilingPurpleColor, ceilingPurpleDistance, ceilingPurpleDecay }
    : PD;

  const v = variant === 'day'
    ? {
        ambientIntensity: 0.72, ambientColor: '#fff3df',
        windowIntensity: 4.2, windowColor: '#ffd7a1', windowAngle: 0.75, windowPenumbra: 0.8, windowDecay: 1.2,
        monitorIntensity: 0.35, monitorColor: '#89d7ff', monitorDistance: 2.8, monitorDecay: 2,
        serverIntensity: 0.18, serverColor: '#a7d8ff', serverDistance: 2.2, serverDecay: 2,
        neonSignIntensity: 0.28, neonSignColor: '#38bdf8', neonSignDistance: 3, neonSignDecay: 2,
        ceilingCyanIntensity: 0.08, ceilingCyanColor: '#bae6fd', ceilingCyanDistance: 4, ceilingCyanDecay: 2,
        ceilingPurpleIntensity: 0.04, ceilingPurpleColor: '#fbcfe8', ceilingPurpleDistance: 3, ceilingPurpleDecay: 2,
      }
    : nightValues;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // 环境光
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = v.ambientIntensity;
      ambientLightRef.current.color.set(v.ambientColor);
    }

    // 窗外主光（带呼吸）
    if (windowLight.current) {
      windowLight.current.intensity = v.windowIntensity + Math.sin(t * 0.3) * 0.2 + Math.sin(t * 0.7) * 0.1;
      windowLight.current.color.set(v.windowColor);
      windowLight.current.angle = v.windowAngle;
      windowLight.current.penumbra = v.windowPenumbra;
      windowLight.current.decay = v.windowDecay;
    }

    // 显示器光（带呼吸）
    if (monitorLight.current) {
      monitorLight.current.intensity = v.monitorIntensity + Math.sin(t * 1.5) * 0.2;
      monitorLight.current.color.set(v.monitorColor);
      monitorLight.current.distance = v.monitorDistance;
      monitorLight.current.decay = v.monitorDecay;
    }

    // 服务器光（带呼吸）
    if (serverLight.current) {
      serverLight.current.intensity = v.serverIntensity + Math.sin(t * 2 + 1) * 0.15;
      serverLight.current.color.set(v.serverColor);
      serverLight.current.distance = v.serverDistance;
      serverLight.current.decay = v.serverDecay;
    }

    // 霓虹招牌（带呼吸）
    if (neonSignLight.current) {
      neonSignLight.current.intensity = v.neonSignIntensity + Math.sin(t * 2 + 2) * 0.25;
      neonSignLight.current.color.set(v.neonSignColor);
      neonSignLight.current.distance = v.neonSignDistance;
      neonSignLight.current.decay = v.neonSignDecay;
    }

    // 天花板灯带
    if (ceilingCyanLight.current) {
      ceilingCyanLight.current.intensity = v.ceilingCyanIntensity;
      ceilingCyanLight.current.color.set(v.ceilingCyanColor);
      ceilingCyanLight.current.distance = v.ceilingCyanDistance;
      ceilingCyanLight.current.decay = v.ceilingCyanDecay;
    }
    if (ceilingPurpleLight.current) {
      ceilingPurpleLight.current.intensity = v.ceilingPurpleIntensity;
      ceilingPurpleLight.current.color.set(v.ceilingPurpleColor);
      ceilingPurpleLight.current.distance = v.ceilingPurpleDistance;
      ceilingPurpleLight.current.decay = v.ceilingPurpleDecay;
    }
  });

  return (
    <>
      <ambientLight ref={ambientLightRef} intensity={v.ambientIntensity} color={v.ambientColor} />

      <spotLight
        ref={windowLight}
        position={[0, 3.0, -6]}
        angle={v.windowAngle}
        penumbra={v.windowPenumbra}
        intensity={v.windowIntensity}
        color={v.windowColor}
        target-position={[0, 0, 2]}
        decay={v.windowDecay}
      />

      {/* 固定补充光 */}
      <pointLight position={[-1, 2.5, -5]} intensity={variant === 'day' ? 0.7 : 0.8} color={variant === 'day' ? '#fff0c4' : '#334488'} distance={10} decay={2} />
      <pointLight position={[1.5, 2, -5]} intensity={variant === 'day' ? 0.22 : 0.4} color={variant === 'day' ? '#dbeafe' : '#662244'} distance={8} decay={2} />

      <pointLight
        ref={monitorLight}
        position={[1.2, 1.2, -2]}
        intensity={v.monitorIntensity}
        color={v.monitorColor}
        distance={v.monitorDistance}
        decay={v.monitorDecay}
      />

      <pointLight
        ref={serverLight}
        position={[2.8, 1, -3]}
        intensity={v.serverIntensity}
        color={v.serverColor}
        distance={v.serverDistance}
        decay={v.serverDecay}
      />

      <pointLight
        ref={neonSignLight}
        position={[0, 3.3, -3.5]}
        intensity={v.neonSignIntensity}
        color={v.neonSignColor}
        distance={v.neonSignDistance}
        decay={v.neonSignDecay}
      />
      <pointLight position={[0, 3.3, -3.5]} intensity={variant === 'day' ? 0.18 : 0.8} color={variant === 'day' ? '#38bdf8' : '#00aacc'} distance={4} decay={2} />

      <pointLight
        ref={ceilingCyanLight}
        position={[-1.2, 3.5, -2]}
        intensity={v.ceilingCyanIntensity}
        color={v.ceilingCyanColor}
        distance={v.ceilingCyanDistance}
        decay={v.ceilingCyanDecay}
      />
      <pointLight
        ref={ceilingPurpleLight}
        position={[1.5, 3.55, 0.5]}
        intensity={v.ceilingPurpleIntensity}
        color={v.ceilingPurpleColor}
        distance={v.ceilingPurpleDistance}
        decay={v.ceilingPurpleDecay}
      />
    </>
  );
}
