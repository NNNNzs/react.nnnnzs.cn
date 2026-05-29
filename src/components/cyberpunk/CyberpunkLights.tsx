/**
 * 赛博朋克灯光系统 - 以窗外城市霓虹光为主要光源
 * 所有参数从 Zustand store 读取
 */

'use client';

import { forwardRef, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore, PRODUCTION_DEFAULTS } from './useSceneStore';
import type { HomepageSceneVariant } from './theme';
import { FURNITURE_LAYOUT, ROOM_OBJECTS } from './sceneLayout';

const PD = PRODUCTION_DEFAULTS.lights;
const isDev = process.env.NODE_ENV === 'development';

function CeilingBarFixture({
  position,
  width,
  color,
  intensity,
  distance,
  decay,
  variant,
}: {
  position: [number, number, number];
  width: number;
  color: string;
  intensity: number;
  distance: number;
  decay: number;
  variant: HomepageSceneVariant;
}) {
  const bodyColor = variant === 'day' ? '#f8fafc' : '#061522';

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[width, 0.06, 0.06]} />
        <meshStandardMaterial color={bodyColor} emissive={color} emissiveIntensity={variant === 'day' ? 0.12 : 0.68} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.03, 0]}>
        <boxGeometry args={[Math.min(width * 0.78, 0.65), 0.016, 0.016]} />
        <meshStandardMaterial color={variant === 'day' ? '#dbeafe' : '#050611'} emissive={color} emissiveIntensity={variant === 'day' ? 0.05 : 0.26} toneMapped={false} />
      </mesh>
      <pointLight position={[0, -0.12, 0]} intensity={intensity} color={color} distance={distance} decay={decay} />
    </group>
  );
}

const PointFixture = forwardRef<THREE.PointLight, {
  position: [number, number, number];
  color: string;
  intensity: number;
  distance: number;
  decay: number;
  bodyColor: string;
  size?: number;
  emissiveIntensity: number;
}>(
  (
    {
      position,
      color,
      intensity,
      distance,
      decay,
      bodyColor,
      size = 0.08,
      emissiveIntensity,
    },
    ref,
  ) => {
    return (
      <group position={position}>
        <mesh>
          <sphereGeometry args={[size, 18, 18]} />
          <meshStandardMaterial color={bodyColor} emissive={color} emissiveIntensity={emissiveIntensity} toneMapped={false} />
        </mesh>
        <mesh position={[0, -size - 0.02, 0]}>
          <cylinderGeometry args={[size * 0.35, size * 0.55, size * 1.3, 12]} />
          <meshStandardMaterial color={bodyColor} metalness={0.55} roughness={0.3} />
        </mesh>
        <pointLight ref={ref} position={[0, 0, 0]} intensity={intensity} color={color} distance={distance} decay={decay} />
      </group>
    );
  },
);

const SpotFixture = forwardRef<THREE.SpotLight, {
  position: [number, number, number];
  color: string;
  intensity: number;
  distance: number;
  angle: number;
  penumbra: number;
  decay: number;
  bodyColor: string;
  emissiveColor: string;
  targetPosition: [number, number, number];
}>(
  (
    {
      position,
      color,
      intensity,
      distance,
      angle,
      penumbra,
      decay,
      bodyColor,
      emissiveColor,
      targetPosition,
    },
    ref,
  ) => {
    const target = useMemo(() => {
      const object = new THREE.Object3D();
      object.position.set(targetPosition[0], targetPosition[1], targetPosition[2]);
      return object;
    }, [targetPosition]);

    return (
      <group position={position}>
        <primitive object={target} />
        <mesh>
          <boxGeometry args={[0.48, 0.12, 0.2]} />
          <meshStandardMaterial color={bodyColor} emissive={emissiveColor} emissiveIntensity={0.18} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.06, 0.05]}>
          <coneGeometry args={[0.08, 0.22, 12]} />
          <meshStandardMaterial color={bodyColor} metalness={0.42} roughness={0.28} />
        </mesh>
        <spotLight
          ref={ref}
          position={[0, 0, 0]}
          angle={angle}
          penumbra={penumbra}
          intensity={intensity}
          color={color}
          distance={distance}
          decay={decay}
          target={target}
        />
      </group>
    );
  },
);

export default function CyberpunkLights({
  variant = 'night',
  performanceTier = 'high',
  enableAnimation = true,
}: {
  variant?: HomepageSceneVariant;
  performanceTier?: 'low' | 'medium' | 'high';
  enableAnimation?: boolean;
}) {
  const windowLight = useRef<THREE.SpotLight>(null);
  const exteriorWindowLight = useRef<THREE.SpotLight>(null);
  const monitorLight = useRef<THREE.PointLight>(null);
  const serverLight = useRef<THREE.PointLight>(null);
  const neonSignLight = useRef<THREE.PointLight>(null);
  const ceilingCyanLight = useRef<THREE.PointLight>(null);
  const ceilingPurpleLight = useRef<THREE.PointLight>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ambientLightRef = useRef<any>(null);
  const animElapsed = useRef(0);
  const staticPropsApplied = useRef(false);

  // Zustand selector 订阅（只在对应值变化时重渲染）
  const ambientIntensity = useSceneStore(st => st.lights.ambientIntensity);
  const ambientColor = useSceneStore(st => st.lights.ambientColor);
  const windowIntensity = useSceneStore(st => st.lights.windowIntensity);
  const windowColor = useSceneStore(st => st.lights.windowColor);
  const windowAngle = useSceneStore(st => st.lights.windowAngle);
  const windowPenumbra = useSceneStore(st => st.lights.windowPenumbra);
  const windowDecay = useSceneStore(st => st.lights.windowDecay);
  const exteriorWindowIntensity = useSceneStore(st => st.lights.exteriorWindowIntensity);
  const exteriorWindowColor = useSceneStore(st => st.lights.exteriorWindowColor);
  const exteriorWindowDistance = useSceneStore(st => st.lights.exteriorWindowDistance);
  const exteriorWindowDecay = useSceneStore(st => st.lights.exteriorWindowDecay);
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
        exteriorWindowIntensity, exteriorWindowColor, exteriorWindowDistance, exteriorWindowDecay,
        ceilingCyanIntensity, ceilingCyanColor, ceilingCyanDistance, ceilingCyanDecay,
        ceilingPurpleIntensity, ceilingPurpleColor, ceilingPurpleDistance, ceilingPurpleDecay }
    : PD;

  const v = variant === 'day'
    ? {
        ambientIntensity: 0.72, ambientColor: '#fff3df',
        windowIntensity: 4.2, windowColor: '#ffd7a1', windowAngle: 0.75, windowPenumbra: 0.8, windowDecay: 1.2,
        exteriorWindowIntensity: 0.35, exteriorWindowColor: '#fff0c4', exteriorWindowDistance: 7, exteriorWindowDecay: 1.4,
        monitorIntensity: 0.35, monitorColor: '#89d7ff', monitorDistance: 2.8, monitorDecay: 2,
        serverIntensity: 0.18, serverColor: '#a7d8ff', serverDistance: 2.2, serverDecay: 2,
        neonSignIntensity: 0.28, neonSignColor: '#38bdf8', neonSignDistance: 3, neonSignDecay: 2,
        ceilingCyanIntensity: 0.08, ceilingCyanColor: '#bae6fd', ceilingCyanDistance: 4, ceilingCyanDecay: 2,
        ceilingPurpleIntensity: 0.04, ceilingPurpleColor: '#fbcfe8', ceilingPurpleDistance: 3, ceilingPurpleDecay: 2,
      }
    : nightValues;
  const nightBoost = variant === 'night' ? 1 : 0;

  useFrame((_, delta) => {
    // 静态属性只设置一次
    if (!staticPropsApplied.current) {
      staticPropsApplied.current = true;

      if (ambientLightRef.current) {
        ambientLightRef.current.color.set(v.ambientColor);
      }
      if (windowLight.current) {
        windowLight.current.color.set(v.windowColor);
        windowLight.current.angle = v.windowAngle;
        windowLight.current.penumbra = v.windowPenumbra;
        windowLight.current.decay = v.windowDecay;
      }
      if (exteriorWindowLight.current) {
        exteriorWindowLight.current.color.set(v.exteriorWindowColor);
        exteriorWindowLight.current.distance = v.exteriorWindowDistance;
        exteriorWindowLight.current.decay = v.exteriorWindowDecay;
        exteriorWindowLight.current.angle = 0.52;
        exteriorWindowLight.current.penumbra = 0.82;
      }
      if (monitorLight.current) {
        monitorLight.current.color.set(v.monitorColor);
        monitorLight.current.distance = v.monitorDistance;
        monitorLight.current.decay = v.monitorDecay;
      }
      if (serverLight.current) {
        serverLight.current.color.set(v.serverColor);
        serverLight.current.distance = v.serverDistance;
        serverLight.current.decay = v.serverDecay;
      }
      if (neonSignLight.current) {
        neonSignLight.current.color.set(v.neonSignColor);
        neonSignLight.current.distance = v.neonSignDistance;
        neonSignLight.current.decay = v.neonSignDecay;
      }
      if (ceilingCyanLight.current) {
        ceilingCyanLight.current.color.set(v.ceilingCyanColor);
        ceilingCyanLight.current.distance = v.ceilingCyanDistance;
        ceilingCyanLight.current.decay = v.ceilingCyanDecay;
      }
      if (ceilingPurpleLight.current) {
        ceilingPurpleLight.current.color.set(v.ceilingPurpleColor);
        ceilingPurpleLight.current.distance = v.ceilingPurpleDistance;
        ceilingPurpleLight.current.decay = v.ceilingPurpleDecay;
      }
    }

    // 无动画时只设置静态 intensity
    if (!enableAnimation) {
      if (ambientLightRef.current) ambientLightRef.current.intensity = v.ambientIntensity;
      if (windowLight.current) windowLight.current.intensity = v.windowIntensity;
      if (exteriorWindowLight.current) exteriorWindowLight.current.intensity = v.exteriorWindowIntensity + nightBoost * 1.1;
      if (monitorLight.current) monitorLight.current.intensity = v.monitorIntensity + nightBoost * 1.2;
      if (serverLight.current) serverLight.current.intensity = v.serverIntensity + nightBoost * 1.0;
      if (neonSignLight.current) neonSignLight.current.intensity = v.neonSignIntensity + nightBoost * 1.8;
      if (ceilingCyanLight.current) ceilingCyanLight.current.intensity = v.ceilingCyanIntensity + nightBoost * 0.9;
      if (ceilingPurpleLight.current) ceilingPurpleLight.current.intensity = v.ceilingPurpleIntensity + nightBoost * 0.9;
      return;
    }

    // 中等性能模式降频：每 100ms 更新一次
    animElapsed.current += delta;
    if (performanceTier !== 'high' && animElapsed.current < 0.1) return;
    animElapsed.current = 0;

    const t = performance.now() * 0.001;

    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = v.ambientIntensity;
    }

    if (windowLight.current) {
      windowLight.current.intensity = v.windowIntensity + Math.sin(t * 0.3) * 0.2 + Math.sin(t * 0.7) * 0.1;
    }

    if (exteriorWindowLight.current) {
      exteriorWindowLight.current.intensity = v.exteriorWindowIntensity + nightBoost * 1.1 + Math.sin(t * 0.45) * 0.12;
    }

    if (monitorLight.current) {
      monitorLight.current.intensity = v.monitorIntensity + nightBoost * 1.2 + Math.sin(t * 1.5) * 0.2;
    }

    if (serverLight.current) {
      serverLight.current.intensity = v.serverIntensity + nightBoost * 1.0 + Math.sin(t * 2 + 1) * 0.15;
    }

    if (neonSignLight.current) {
      neonSignLight.current.intensity = v.neonSignIntensity + nightBoost * 1.8 + Math.sin(t * 2 + 2) * 0.25;
    }

    if (ceilingCyanLight.current) {
      ceilingCyanLight.current.intensity = v.ceilingCyanIntensity + nightBoost * 0.9;
    }
    if (ceilingPurpleLight.current) {
      ceilingPurpleLight.current.intensity = v.ceilingPurpleIntensity + nightBoost * 0.9;
    }
  });

  return (
    <>
      <ambientLight ref={ambientLightRef} intensity={v.ambientIntensity} color={v.ambientColor} />

      <SpotFixture
        ref={windowLight}
        position={[0, 3.0, -6]}
        color={v.windowColor}
        intensity={v.windowIntensity}
        distance={15}
        angle={v.windowAngle}
        penumbra={v.windowPenumbra}
        decay={v.windowDecay}
        bodyColor={variant === 'day' ? '#f8fafc' : '#0b1020'}
        emissiveColor={v.windowColor}
        targetPosition={[0, 0, 2]}
      />
      <SpotFixture
        ref={exteriorWindowLight}
        position={[-0.6, 2.85, -5.4]}
        color={v.exteriorWindowColor}
        intensity={v.exteriorWindowIntensity + nightBoost * 1.1}
        distance={v.exteriorWindowDistance}
        angle={0.52}
        penumbra={0.82}
        decay={v.exteriorWindowDecay}
        bodyColor={variant === 'day' ? '#f8fafc' : '#0b1020'}
        emissiveColor={v.exteriorWindowColor}
        targetPosition={[0.15, 1.1, -0.85]}
      />

      {/* 固定补充光 */}
      <PointFixture
        position={[-1, 2.5, -5]}
        color={variant === 'day' ? '#fff0c4' : '#334488'}
        intensity={variant === 'day' ? 0.7 : 0.8}
        distance={10}
        decay={2}
        bodyColor={variant === 'day' ? '#f8fafc' : '#0b1020'}
        emissiveIntensity={variant === 'day' ? 0.08 : 0.22}
      />
      <PointFixture
        position={[1.5, 2, -5]}
        color={variant === 'day' ? '#dbeafe' : '#662244'}
        intensity={variant === 'day' ? 0.22 : 0.4}
        distance={8}
        decay={2}
        bodyColor={variant === 'day' ? '#f8fafc' : '#12081f'}
        emissiveIntensity={variant === 'day' ? 0.06 : 0.2}
        size={0.065}
      />

      <PointFixture
        ref={monitorLight}
        position={[FURNITURE_LAYOUT.desk.position[0], 1.2, FURNITURE_LAYOUT.desk.position[2]]}
        color={v.monitorColor}
        intensity={v.monitorIntensity + nightBoost * 1.2}
        distance={v.monitorDistance + nightBoost * 1.2}
        decay={v.monitorDecay}
        bodyColor={variant === 'day' ? '#f8fafc' : '#061522'}
        emissiveIntensity={variant === 'day' ? 0.12 : 0.34}
        size={0.06}
      />

      <PointFixture
        ref={serverLight}
        position={[FURNITURE_LAYOUT.serverRack.position[0], 1, FURNITURE_LAYOUT.serverRack.position[2]]}
        color={v.serverColor}
        intensity={v.serverIntensity + nightBoost * 1.0}
        distance={v.serverDistance + nightBoost * 1.2}
        decay={v.serverDecay}
        bodyColor={variant === 'day' ? '#f8fafc' : '#12081f'}
        emissiveIntensity={variant === 'day' ? 0.1 : 0.3}
        size={0.055}
      />

      <PointFixture
        ref={neonSignLight}
        position={[FURNITURE_LAYOUT.neonSign.position[0], 3.3, FURNITURE_LAYOUT.neonSign.position[2] + 0.4]}
        color={v.neonSignColor}
        intensity={v.neonSignIntensity + nightBoost * 1.8}
        distance={v.neonSignDistance + nightBoost * 1.5}
        decay={v.neonSignDecay}
        bodyColor={variant === 'day' ? '#f8fafc' : '#160617'}
        emissiveIntensity={variant === 'day' ? 0.12 : 0.4}
        size={0.07}
      />
      <PointFixture
        position={[0, 3.3, -3.5]}
        color={variant === 'day' ? '#38bdf8' : '#00aacc'}
        intensity={variant === 'day' ? 0.18 : 2.2}
        distance={5.5}
        decay={2}
        bodyColor={variant === 'day' ? '#f8fafc' : '#061522'}
        emissiveIntensity={variant === 'day' ? 0.08 : 0.34}
        size={0.08}
      />

      {ROOM_OBJECTS.ceilingLightBars.map((bar) => (
        <CeilingBarFixture
          key={`ceiling-light-${bar.style}-${bar.position.join('-')}`}
          position={[bar.position[0], bar.position[1] - 0.12, bar.position[2]]}
          width={bar.bounds.width}
          color={
            bar.style === 'cool-purple'
              ? (variant === 'day' ? '#bae6fd' : '#8844ff')
              : bar.style === 'alert-pink'
                ? (variant === 'day' ? '#fde68a' : '#ff0066')
                : (variant === 'day' ? '#ffe8bf' : '#00f0ff')
          }
          intensity={variant === 'day' ? 0.08 : 1.6}
          distance={variant === 'day' ? 2.4 : 4.8}
          decay={1.7}
          variant={variant}
        />
      ))}

      <PointFixture
        ref={ceilingCyanLight}
        position={[-1.2, 3.5, -2]}
        color={v.ceilingCyanColor}
        intensity={v.ceilingCyanIntensity}
        distance={v.ceilingCyanDistance}
        decay={v.ceilingCyanDecay}
        bodyColor={variant === 'day' ? '#f8fafc' : '#061522'}
        emissiveIntensity={variant === 'day' ? 0.1 : 0.42}
        size={0.075}
      />
      <PointFixture
        ref={ceilingPurpleLight}
        position={[1.5, 3.55, 0.5]}
        color={v.ceilingPurpleColor}
        intensity={v.ceilingPurpleIntensity}
        distance={v.ceilingPurpleDistance}
        decay={v.ceilingPurpleDecay}
        bodyColor={variant === 'day' ? '#f8fafc' : '#12081f'}
        emissiveIntensity={variant === 'day' ? 0.1 : 0.42}
        size={0.075}
      />
    </>
  );
}
