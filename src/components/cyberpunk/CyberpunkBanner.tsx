/**
 * 赛博朋克 3D Banner
 * 替换首页的静态背景图，展示一个有生活感的赛博朋克小公寓房间
 *
 * 功能：
 * - 3D 房间场景（地板/墙/天花/窗户）
 * - Bloom 霓虹发光后处理
 * - 窗户雨滴效果
 * - 鼠标视差 / OrbitControls（开发模式）
 * - 滚动淡出过渡
 * - 低端设备降级（回退到静态背景）
 */

'use client';

import React, { Suspense, useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import Link from 'next/link';
import { CloseOutlined, CompassOutlined, DownOutlined } from '@ant-design/icons';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';
import Room from './Room';
import RainEffect from './RainEffect';
import Furniture from './Furniture';
import CyberpunkLights from './CyberpunkLights';
import { useSceneStore, PRODUCTION_DEFAULTS } from './useSceneStore';
import { HOMEPAGE_THEME_PRESETS, type HomepageSceneVariant } from './theme';
import { getBannerSubtitle } from '@/lib/content';
import type { Post } from '@/types';

// ========================
// 常量
// ========================

type CameraFocusKey = 'default' | 'desk' | 'living' | 'bookshelf' | 'server' | 'sleep';

interface CameraFocusPreset {
  key: CameraFocusKey;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  marker: [number, number, number];
  fov: number;
}

const DEFAULT_CAMERA_TARGET: [number, number, number] = [0.25, 1.02, -1.35];

const CAMERA_FOCUS_PRESETS: Record<CameraFocusKey, CameraFocusPreset> = {
  default: {
    key: 'default',
    label: '默认',
    position: [-2.85, 2.2, 2.9],
    target: DEFAULT_CAMERA_TARGET,
    marker: [0, 1.45, 2.2],
    fov: 68,
  },
  desk: {
    key: 'desk',
    label: '工作区',
    position: [-0.65, 1.8, 1.15],
    target: [-2.18, 1.05, -2.18],
    marker: [-1.85, 1.4, -1.9],
    fov: 46,
  },
  living: {
    key: 'living',
    label: '全息桌',
    position: [2.0, 2.0, 2.45],
    target: [-0.08, 0.86, 0.72],
    marker: [-0.08, 1.4, 0.72],
    fov: 42,
  },
  bookshelf: {
    key: 'bookshelf',
    label: '书架',
    position: [0.95, 1.9, -0.7],
    target: [3.3, 1.35, -2.58],
    marker: [3.15, 2.22, -2.58],
    fov: 42,
  },
  server: {
    key: 'server',
    label: '服务器',
    position: [0.95, 1.8, 0.42],
    target: [3.3, 1.02, -1.42],
    marker: [3.15, 1.68, -1.42],
    fov: 40,
  },
  sleep: {
    key: 'sleep',
    label: '睡眠区',
    position: [-0.75, 1.75, 2.5],
    target: [2.35, 0.72, 0.22],
    marker: [2.35, 1.05, 0.22],
    fov: 44,
  },
};

const getCameraFocusPreset = (
  key: CameraFocusKey,
  variant: HomepageSceneVariant,
  editable: boolean,
  editablePosition: [number, number, number],
  editableFov: number,
): CameraFocusPreset => {
  if (editable) {
    return {
      ...CAMERA_FOCUS_PRESETS.default,
      position: editablePosition,
      fov: editableFov,
    };
  }

  if (key === 'default') {
    const preset = HOMEPAGE_THEME_PRESETS[variant];
    return {
      ...CAMERA_FOCUS_PRESETS.default,
      position: preset.camera.position,
      fov: preset.camera.fov,
    };
  }

  return CAMERA_FOCUS_PRESETS[key];
};

const isWebGLAvailable = (): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    return 'WebGLRenderingContext' in window && !!gl;
  } catch {
    return false;
  }
};

const isLowEndDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      hardwareConcurrency?: number;
    };
    if (nav.deviceMemory && nav.deviceMemory <= 4) return true;
    if (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) return true;

    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return true;
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      const lowEndKeywords = ['mali-4', 'adreno 3', 'adreno 4', 'powervr sgx', 'intel hd graphics', 'intel uhd graphics'];
      return lowEndKeywords.some((k: string) => (renderer as string).toLowerCase().includes(k));
    }
  } catch {
    // 无法检测时保守降级
  }
  return false;
};

// ========================
// 相机控制器（鼠标视差）
// ========================

function ParallaxCamera({ editable, variant }: { editable: boolean; variant: HomepageSceneVariant }) {
  const mouse = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const wheelZoom = useRef(0);
  const preset = HOMEPAGE_THEME_PRESETS[variant];

  // 开发模式订阅 store，生产模式不需要
  const camX = useSceneStore(s => s.camera.positionX);
  const camY = useSceneStore(s => s.camera.positionY);
  const camZ = useSceneStore(s => s.camera.positionZ);
  const lookX = useSceneStore(s => s.camera.lookAtX);
  const lookY = useSceneStore(s => s.camera.lookAtY);
  const lookZ = useSceneStore(s => s.camera.lookAtZ);
  const parallaxEnabled = useSceneStore(s => s.parallax.enabled);
  const parallaxX = useSceneStore(s => s.parallax.intensityX);
  const parallaxY = useSceneStore(s => s.parallax.intensityY);
  const parallaxSmooth = useSceneStore(s => s.parallax.smoothness);

  // 生产模式默认值
  const d = PRODUCTION_DEFAULTS;
  const pCamX = editable ? camX : preset.camera.position[0];
  const pCamY = editable ? camY : preset.camera.position[1];
  const pCamZ = editable ? camZ : preset.camera.position[2];
  const pLookX = editable ? lookX : d.camera.lookAtX;
  const pLookY = editable ? lookY : d.camera.lookAtY;
  const pLookZ = editable ? lookZ : d.camera.lookAtZ;
  const pEnabled = editable ? parallaxEnabled : true;
  const pX = editable ? parallaxX : d.parallax.intensityX;
  const pY = editable ? parallaxY : d.parallax.intensityY;
  const pSmooth = editable ? parallaxSmooth : d.parallax.smoothness;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.altKey) return;
      if (window.scrollY >= window.innerHeight) return;
      e.preventDefault();
      wheelZoom.current = Math.max(-2.2, Math.min(4, wheelZoom.current + e.deltaY * 0.003));
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  useFrame(({ camera }) => {
    if (!pEnabled) return;

    target.current.x += (mouse.current.x - target.current.x) * pSmooth;
    target.current.y += (mouse.current.y - target.current.y) * pSmooth;

    camera.position.x = pCamX + target.current.x * pX;
    camera.position.y = pCamY + target.current.y * pY;
    camera.position.z += (pCamZ + wheelZoom.current - camera.position.z) * 0.08;
    camera.lookAt(pLookX, pLookY, pLookZ);
  });

  return null;
}

function CameraFocusController({
  focus,
  flightId,
  controlsRef,
  instant = false,
}: {
  focus: CameraFocusPreset;
  flightId: number;
  controlsRef?: React.RefObject<React.ElementRef<typeof OrbitControls> | null>;
  instant?: boolean;
}) {
  const currentTarget = useRef(new THREE.Vector3(...focus.target));
  const desiredPosition = useRef(new THREE.Vector3(...focus.position));
  const desiredTarget = useRef(new THREE.Vector3(...focus.target));
  const needsInstantSync = useRef(instant);
  const flightActive = useRef(true);

  useEffect(() => {
    desiredPosition.current.set(...focus.position);
    desiredTarget.current.set(...focus.target);
    needsInstantSync.current = instant;
    flightActive.current = true;
  }, [flightId, focus, instant]);

  useFrame(({ camera }) => {
    if (!flightActive.current) return;

    const factor = needsInstantSync.current ? 1 : 0.08;
    camera.position.lerp(desiredPosition.current, factor);
    currentTarget.current.lerp(desiredTarget.current, factor);

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov += (focus.fov - camera.fov) * factor;
      camera.updateProjectionMatrix();
    }

    if (controlsRef?.current) {
      controlsRef.current.target.copy(currentTarget.current);
      controlsRef.current.update();
    }

    if (!controlsRef?.current) {
      camera.lookAt(currentTarget.current);
    }

    const positionSettled = camera.position.distanceTo(desiredPosition.current) < 0.02;
    const targetSettled = currentTarget.current.distanceTo(desiredTarget.current) < 0.02;
    const fovSettled = !(camera instanceof THREE.PerspectiveCamera) || Math.abs(camera.fov - focus.fov) < 0.05;

    needsInstantSync.current = false;
    if (positionSettled && targetSettled && fovSettled) {
      flightActive.current = false;
    }
  });

  return null;
}

function SceneHotspots({
  activeFocusKey,
  onFocusChange,
}: {
  activeFocusKey: CameraFocusKey;
  onFocusChange: (key: CameraFocusKey) => void;
}) {
  return (
    <>
      {(['desk', 'living', 'bookshelf', 'server', 'sleep'] as CameraFocusKey[]).map((key) => {
        const focus = CAMERA_FOCUS_PRESETS[key];
        const active = activeFocusKey === key;

        return (
          <Html
            key={key}
            position={focus.marker}
            center
            distanceFactor={7}
            zIndexRange={[30, 10]}
            occlude={false}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onFocusChange(key);
              }}
              onDoubleClick={(event) => event.stopPropagation()}
              className={`group flex cursor-pointer items-center gap-2 whitespace-nowrap border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] backdrop-blur transition ${
                active
                  ? 'border-cyan-200 bg-cyan-200/22 text-cyan-50 shadow-[0_0_30px_rgba(34,211,238,0.45)]'
                  : 'border-cyan-200/55 bg-[#050611]/70 text-cyan-50/86 shadow-[0_0_24px_rgba(34,211,238,0.22)] hover:border-cyan-100 hover:bg-cyan-200/16 hover:text-white'
              }`}
            >
              <span className="relative h-2.5 w-2.5 rounded-full bg-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.95)] before:absolute before:-inset-1 before:rounded-full before:border before:border-cyan-200/55 before:content-['']" />
              {focus.label}
            </button>
          </Html>
        );
      })}
    </>
  );
}

// ========================
// 后处理
// ========================

function PostProcessing({ editable, variant }: { editable: boolean; variant: HomepageSceneVariant }) {
  const preset = HOMEPAGE_THEME_PRESETS[variant];

  const bloomThreshold = useSceneStore(s => s.postProcessing.bloomThreshold);
  const bloomSmoothing = useSceneStore(s => s.postProcessing.bloomSmoothing);
  const bloomIntensity = useSceneStore(s => s.postProcessing.bloomIntensity);
  const vignetteDarkness = useSceneStore(s => s.postProcessing.vignetteDarkness);

  return (
    <EffectComposer>
      <Bloom
        luminanceThreshold={editable && variant === 'night' ? bloomThreshold : preset.postProcessing.bloomThreshold}
        luminanceSmoothing={editable && variant === 'night' ? bloomSmoothing : preset.postProcessing.bloomSmoothing}
        intensity={editable && variant === 'night' ? bloomIntensity : preset.postProcessing.bloomIntensity}
        mipmapBlur
      />
      <Vignette
        eskil={false}
        offset={0.1}
        darkness={editable && variant === 'night' ? vignetteDarkness : preset.postProcessing.vignetteDarkness}
      />
    </EffectComposer>
  );
}

// ========================
// 加载中占位
// ========================

function LoadingFallback({ variant }: { variant: HomepageSceneVariant }) {
  const isDay = variant === 'day';

  return (
    <div className={`absolute inset-0 flex items-center justify-center ${isDay ? 'bg-[#f8fafc]' : 'bg-[#0a0a1a]'}`}>
      <div className="flex flex-col items-center gap-4">
        <div className={`h-8 w-8 animate-spin rounded-full border-2 border-t-transparent ${isDay ? 'border-sky-500' : 'border-[#00f0ff]'}`} />
        <p className={`text-sm font-mono ${isDay ? 'text-sky-700/70' : 'text-[#00f0ff]/70'}`}>INITIALIZING...</p>
      </div>
    </div>
  );
}

// ========================
// 错误回退
// ========================

function ErrorFallback({ variant }: { variant: HomepageSceneVariant }) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center ${variant === 'day' ? 'bg-[#f8fafc]' : 'bg-[#0a0a1a]'}`}>
      <p className="text-[#ff0066]/70 text-sm font-mono">RENDER ERROR</p>
    </div>
  );
}

// ========================
// 首屏 HUD 覆盖层
// ========================

function HeroInterfaceOverlay({
  sceneReady,
  variant,
  posts = [],
  interactiveMode,
  activeFocusKey,
  canExplore = true,
  onExplore,
  onExitExplore,
  onFocusChange,
}: {
  sceneReady: boolean;
  variant: HomepageSceneVariant;
  posts?: Post[];
  interactiveMode: boolean;
  activeFocusKey: CameraFocusKey;
  canExplore?: boolean;
  onExplore: () => void;
  onExitExplore: () => void;
  onFocusChange: (key: CameraFocusKey) => void;
}) {
  const isDay = variant === 'day';
  const statuses = isDay
    ? ['DAY ROOM', 'CLEAR WINDOW', 'NOTES READY', 'LOW BLOOM']
    : ['ROOM ONLINE', 'RAIN 73%', 'POST ARCHIVE LINKED', 'BLOOM ACTIVE'];
  const recentPosts = posts.slice(0, 3);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <div className="cyberpunk-hero-atmosphere" />
      {!isDay && <div className="cyberpunk-scanline" />}

      <div
        className={`absolute left-4 right-4 top-[14vh] max-w-5xl transition-all duration-700 md:left-10 lg:left-16 ${
          sceneReady ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-sky-900/65 dark:text-cyan-100/65">
          <span className="cyberpunk-kicker">{isDay ? 'NEON NOMAD / DAYLIGHT NOTES' : 'NEON NOMAD / NIGHT ZONES'}</span>
          <span className="h-px w-10 bg-sky-500/40 dark:bg-cyan-300/40" />
          <span>{isDay ? 'SUNLIT SESSION' : '2147 RAIN SESSION'}</span>
        </div>

        <h1 className="cyberpunk-hero-title">
          NNNNzs
        </h1>

        <p className="mt-4 max-w-xl text-sm leading-7 text-slate-700/78 dark:text-slate-200/74 md:text-base">
          {getBannerSubtitle(variant)}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {statuses.map((item) => (
            <span key={item} className="cyberpunk-status-chip">
              {item}
            </span>
          ))}
        </div>

        {canExplore && (
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onDoubleClick={(event) => event.stopPropagation()}
              onClick={interactiveMode ? onExitExplore : onExplore}
              className="pointer-events-auto inline-flex cursor-pointer items-center gap-2 border border-pink-500/25 bg-white/52 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-pink-900/70 backdrop-blur transition hover:border-pink-600/45 hover:text-pink-950 dark:border-pink-300/30 dark:bg-pink-300/[0.08] dark:text-pink-100/76 dark:hover:border-pink-200/70 dark:hover:text-pink-50"
            >
              {interactiveMode ? <CloseOutlined /> : <CompassOutlined />}
              {interactiveMode ? '退出探索' : '探索场景'}
            </button>
            <span className="pointer-events-none inline-flex items-center border border-cyan-300/20 bg-white/36 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-slate-700/60 backdrop-blur dark:bg-cyan-300/[0.06] dark:text-cyan-100/62">
              双击场景进入/退出
            </span>
          </div>
        )}
      </div>

      <div
        className={`absolute bottom-20 right-4 hidden w-72 transition-all duration-700 lg:right-12 ${isDay ? 'md:hidden' : 'md:block'} ${
          sceneReady ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        <div className="cyberpunk-diagnostic-panel">
          <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-sky-900/55 dark:text-cyan-100/55">
            <span>Recent Logs</span>
            <span>{String(recentPosts.length).padStart(2, '0')} linked</span>
          </div>
          <div className="space-y-2">
            {recentPosts.map((post, index) => (
              <Link
                key={post.id}
                href={post.path || '#'}
                prefetch={false}
                className="pointer-events-auto flex items-center gap-3 text-slate-700/75 transition hover:text-sky-800 dark:text-slate-200/75 dark:hover:text-cyan-100"
              >
                <span className="h-1.5 w-1.5 bg-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.45)] dark:bg-cyan-300 dark:shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
                <span className="min-w-0 flex-1 truncate text-xs">{post.title}</span>
                <span className="font-mono text-xs text-pink-700/75 dark:text-pink-200/80">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {interactiveMode && (
        <div className="absolute bottom-24 left-4 right-4 z-20 mx-auto max-w-sm border border-cyan-300/35 bg-[#050611]/76 px-4 py-3 text-center text-xs uppercase tracking-[0.2em] text-cyan-100/78 shadow-[0_0_34px_rgba(34,211,238,0.16)] backdrop-blur md:bottom-8">
          拖动旋转场景，双指缩放。右键或再次双击退出。
        </div>
      )}

      {canExplore && (
        <div
          className={`absolute bottom-24 right-4 z-20 w-40 transition-all duration-700 md:bottom-auto md:right-8 md:top-1/2 md:-translate-y-1/2 ${
            sceneReady ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <div className="mb-2 border border-cyan-300/25 bg-white/42 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-950/62 backdrop-blur dark:bg-[#050611]/72 dark:text-cyan-100/72">
            热点区
          </div>
          <div className="flex flex-col gap-2">
            {(Object.values(CAMERA_FOCUS_PRESETS) as CameraFocusPreset[]).map((focus) => {
              const active = focus.key === activeFocusKey;
              const buttonTone = isDay
                ? active
                  ? 'border-sky-500/70 bg-sky-100/82 text-sky-950 shadow-[0_0_24px_rgba(14,165,233,0.18)]'
                  : 'border-sky-500/24 bg-white/72 text-sky-950/72 hover:border-sky-500/55 hover:bg-sky-50/86 hover:text-sky-950'
                : active
                  ? 'border-cyan-300/80 bg-cyan-200/20 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.24)]'
                  : 'border-white/18 bg-[#050611]/50 text-slate-100/76 hover:border-cyan-300/55 hover:text-cyan-50';
              return (
                <button
                  key={focus.key}
                  type="button"
                  onDoubleClick={(event) => event.stopPropagation()}
                  onClick={() => onFocusChange(focus.key)}
                  className={`pointer-events-auto flex cursor-pointer items-center justify-between gap-2 border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] backdrop-blur transition ${buttonTone}`}
                >
                  <span>{focus.label}</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? (isDay ? 'bg-sky-600' : 'bg-cyan-200') : (isDay ? 'bg-sky-400/45' : 'bg-white/45')}`} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ========================
// 3D 场景内容
// ========================

function Scene({
  debugControlsOpen,
  interactiveMode,
  variant,
  focus,
  focusFlightId,
  activeFocusKey,
  onFocusChange,
}: {
  debugControlsOpen: boolean;
  interactiveMode: boolean;
  variant: HomepageSceneVariant;
  focus: CameraFocusPreset;
  focusFlightId: number;
  activeFocusKey: CameraFocusKey;
  onFocusChange: (key: CameraFocusKey) => void;
}) {
  const editable = debugControlsOpen;
  const [wheelZoomEnabled, setWheelZoomEnabled] = useState(false);
  const controlsRef = useRef<React.ElementRef<typeof OrbitControls> | null>(null);

  // Zustand selector - 只有对应字段变化时才重渲染
  const useOrbit = useSceneStore(s => s.controls.useOrbit);
  const showRain = useSceneStore(s => s.elements.showRain);
  const showFurniture = useSceneStore(s => s.elements.showFurniture);
  const showRoom = useSceneStore(s => s.elements.showRoom);
  const showGrid = useSceneStore(s => s.elements.showGrid);
  const parallaxEnabled = useSceneStore(s => s.parallax.enabled);

  const pUseOrbit = editable ? useOrbit : interactiveMode;
  const shouldUseParallax = !pUseOrbit && focus.key === 'default';
  const pShowRain = variant === 'night' && (editable ? showRain : true);
  const pShowFurniture = editable ? showFurniture : true;
  const pShowRoom = editable ? showRoom : true;
  const pShowGrid = editable ? showGrid : false;
  const fogColor = variant === 'day' ? '#f8fafc' : '#050611';

  useEffect(() => {
    const syncWheelZoomEnabled = (event?: KeyboardEvent) => {
      setWheelZoomEnabled(Boolean(event?.altKey));
    };

    const handleKeyDown = (event: KeyboardEvent) => syncWheelZoomEnabled(event);
    const handleKeyUp = (event: KeyboardEvent) => syncWheelZoomEnabled(event);
    const handleBlur = () => setWheelZoomEnabled(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return (
    <>
      <fog attach="fog" args={[fogColor, variant === 'day' ? 11 : 8, variant === 'day' ? 23 : 19]} />
      {shouldUseParallax && <ParallaxCamera editable={editable || parallaxEnabled} variant={variant} />}
      {!shouldUseParallax && (
        <CameraFocusController
          focus={focus}
          flightId={focusFlightId}
          controlsRef={pUseOrbit ? controlsRef : undefined}
          instant={editable}
        />
      )}
      {pUseOrbit && (
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={interactiveMode || editable}
          enableDamping
          dampingFactor={0.05}
          minDistance={2}
          maxDistance={15}
          enableZoom={interactiveMode || wheelZoomEnabled}
          enablePan={editable}
          enableRotate={interactiveMode || editable}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2}
          target={focus.target}
        />
      )}
      <CyberpunkLights variant={variant} />
      {pShowGrid && (
        <Grid
          args={[20, 20]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#00f0ff"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#ff0066"
          fadeDistance={30}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid
        />
      )}
      {pShowRoom && <Room variant={variant} />}
      {pShowFurniture && <Furniture variant={variant} />}
      {pShowFurniture && (
        <SceneHotspots
          activeFocusKey={activeFocusKey}
          onFocusChange={onFocusChange}
        />
      )}
      {pShowRain && <RainEffect />}
      <PostProcessing editable={editable} variant={variant} />
    </>
  );
}

// ========================
// 滚动淡出遮罩
// ========================

function ScrollFadeOverlay({ scrollProgress, variant }: { scrollProgress: number; variant: HomepageSceneVariant }) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none transition-opacity duration-100 ${variant === 'day' ? 'bg-[#f8fafc]' : 'bg-[#0a0a1a]'}`}
      style={{ opacity: Math.min(scrollProgress * 2, 1) }}
    />
  );
}

// ========================
// 主组件
// ========================

export default function CyberpunkBanner({
  variant = 'night',
  posts = [],
}: {
  variant?: HomepageSceneVariant;
  posts?: Post[];
}) {
  const [capabilityChecked, setCapabilityChecked] = useState(false);
  const [webglOk, setWebglOk] = useState(false);
  const [lowEnd, setLowEnd] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [debugControlsOpen, setDebugControlsOpen] = useState(false);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [activeFocusKey, setActiveFocusKey] = useState<CameraFocusKey>('default');
  const [focusFlightId, setFocusFlightId] = useState(0);
  const devControlsModuleRef = useRef<Promise<typeof import('./DevControls')> | null>(null);
  const preset = HOMEPAGE_THEME_PRESETS[variant];

  const camPosX = useSceneStore(s => s.camera.positionX);
  const camPosY = useSceneStore(s => s.camera.positionY);
  const camPosZ = useSceneStore(s => s.camera.positionZ);
  const cameraFov = useSceneStore(s => s.camera.fov);

  const cameraEditable = debugControlsOpen;
  const cameraPos: [number, number, number] = cameraEditable
    ? [camPosX, camPosY, camPosZ]
    : preset.camera.position;
  const fov = cameraEditable ? cameraFov : preset.camera.fov;
  const activeFocus = getCameraFocusPreset(activeFocusKey, variant, cameraEditable, cameraPos, fov);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!isWebGLAvailable()) {
        setWebglOk(false);
        setCapabilityChecked(true);
        return;
      }
      setWebglOk(true);
      if (isLowEndDevice()) {
        setLowEnd(true);
      }
      setCapabilityChecked(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    syncPreference();
    mediaQuery.addEventListener('change', syncPreference);
    return () => mediaQuery.removeEventListener('change', syncPreference);
  }, []);

  useEffect(() => {
    const storageKey = 'cyberpunk-debug-panel';
    let debugPanelRequested = false;

    const loadDevControls = () => {
      devControlsModuleRef.current ??= import('./DevControls');
      return devControlsModuleRef.current;
    };

    const shouldOpenDebugPanel = () => {
      const params = new URLSearchParams(window.location.search);
      return (
        params.get('sceneDebug') === '1' ||
        params.get('debug') === 'cyberpunk' ||
        params.get('debug') === 'scene' ||
        window.sessionStorage.getItem(storageKey) === '1'
      );
    };

    const syncDebugPanel = () => {
      if (shouldOpenDebugPanel()) {
        debugPanelRequested = true;
        setDebugControlsOpen(true);
        void loadDevControls().then(({ destroyDevControls, renderDevControls }) => {
          if (debugPanelRequested) {
            renderDevControls();
          } else {
            destroyDevControls();
          }
        });
      } else {
        debugPanelRequested = false;
        setDebugControlsOpen(false);
        void devControlsModuleRef.current?.then(({ destroyDevControls }) => {
          destroyDevControls();
        });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.altKey && e.shiftKey && e.code === 'KeyS')) return;
      e.preventDefault();
      const nextValue = window.sessionStorage.getItem(storageKey) === '1' ? '0' : '1';
      window.sessionStorage.setItem(storageKey, nextValue);
      syncDebugPanel();
    };

    window.localStorage.removeItem(storageKey);
    syncDebugPanel();
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      debugPanelRequested = false;
      window.removeEventListener('keydown', handleKeyDown);
      void devControlsModuleRef.current?.then(({ destroyDevControls }) => {
        destroyDevControls();
      });
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const progress = Math.max(0, window.scrollY / window.innerHeight);
        setScrollProgress(progress);
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  const handleCreated = useCallback(() => {
    setSceneReady(true);
  }, []);

  const setCameraFocus = useCallback((key: CameraFocusKey) => {
    setActiveFocusKey(key);
    setFocusFlightId((value) => value + 1);
  }, []);

  const enterExploreMode = useCallback(() => {
    setCameraFocus('default');
    setInteractiveMode(true);
  }, [setCameraFocus]);

  const exitExploreMode = useCallback(() => {
    setInteractiveMode(false);
    setCameraFocus('default');
  }, [setCameraFocus]);

  const handleSceneDoubleClick = useCallback(() => {
    if (interactiveMode) {
      exitExploreMode();
      return;
    }

    enterExploreMode();
  }, [enterExploreMode, exitExploreMode, interactiveMode]);

  const handleSceneContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!interactiveMode) return;
    event.preventDefault();
    exitExploreMode();
  }, [exitExploreMode, interactiveMode]);

  useEffect(() => {
    const handleWindowDoubleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('button, a, input, textarea, select, [role="button"]')) return;
      handleSceneDoubleClick();
    };

    window.addEventListener('dblclick', handleWindowDoubleClick);
    return () => window.removeEventListener('dblclick', handleWindowDoubleClick);
  }, [handleSceneDoubleClick]);

  useEffect(() => {
    if (!interactiveMode) return;

    const handleWindowContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      exitExploreMode();
    };

    window.addEventListener('contextmenu', handleWindowContextMenu);
    return () => window.removeEventListener('contextmenu', handleWindowContextMenu);
  }, [exitExploreMode, interactiveMode]);

  if (!capabilityChecked || !webglOk || lowEnd || prefersReducedMotion || hasError) {
    return (
      <div className={`relative h-screen overflow-hidden ${variant === 'day' ? 'bg-[#f8fafc]' : 'bg-[#050611]'}`}>
        <div className="cyberpunk-static-fallback" />
        <HeroInterfaceOverlay
          sceneReady
          variant={variant}
          posts={posts}
          interactiveMode={false}
          activeFocusKey="default"
          canExplore={false}
          onExplore={() => undefined}
          onExitExplore={() => undefined}
          onFocusChange={() => undefined}
        />
        <div className="absolute bottom-10 left-4 right-4 z-10 text-center text-xs uppercase tracking-[0.28em] text-sky-900/50 dark:text-cyan-100/50">
          {prefersReducedMotion ? 'Reduced motion visual mode' : 'Static visual mode'}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-screen overflow-hidden ${variant === 'day' ? 'bg-[#f8fafc]' : 'bg-[#050611]'}`}>
      <div
        onContextMenu={handleSceneContextMenu}
        className="absolute inset-0 cursor-crosshair"
        style={{
          opacity: sceneReady ? 1 : 0,
          transition: 'opacity 1s ease',
          touchAction: interactiveMode ? 'none' : 'pan-y',
        }}
      >
        <Canvas
          camera={{
            position: cameraPos,
            fov: fov,
            near: 0.1,
            far: 200,
          }}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          }}
          dpr={[1, 1.5]}
          onCreated={handleCreated}
          onError={() => setHasError(true)}
        >
          <Suspense fallback={null}>
            <Scene
              debugControlsOpen={debugControlsOpen}
              interactiveMode={interactiveMode}
              variant={variant}
              focus={activeFocus}
              focusFlightId={focusFlightId}
              activeFocusKey={activeFocusKey}
              onFocusChange={setCameraFocus}
            />
          </Suspense>
        </Canvas>
      </div>

      {!sceneReady && !hasError && <LoadingFallback variant={variant} />}
      {hasError && <ErrorFallback variant={variant} />}
      <HeroInterfaceOverlay
        sceneReady={sceneReady && !hasError}
        variant={variant}
        posts={posts}
        interactiveMode={interactiveMode}
        activeFocusKey={activeFocusKey}
        onExplore={enterExploreMode}
        onExitExplore={exitExploreMode}
        onFocusChange={setCameraFocus}
      />
      <ScrollFadeOverlay scrollProgress={scrollProgress} variant={variant} />

      <div
        onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
        className={`absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-2 text-center transition-colors ${
          variant === 'day' ? 'text-sky-900/60 hover:text-sky-950' : 'text-[#8df7ff]/70 hover:text-[#8df7ff]'
        }`}
      >
        <span className="text-[10px] uppercase tracking-[0.36em]">logs</span>
        <DownOutlined className="animate-bounce text-3xl" />
      </div>
    </div>
  );
}
