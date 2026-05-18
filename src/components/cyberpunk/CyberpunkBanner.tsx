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
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { DownOutlined } from '@ant-design/icons';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { OrbitControls, Grid } from '@react-three/drei';
import Room from './Room';
import RainEffect from './RainEffect';
import Furniture from './Furniture';
import CyberpunkLights from './CyberpunkLights';
import { useSceneStore, PRODUCTION_DEFAULTS } from './useSceneStore';
import { renderDevControls } from './DevControls';

// ========================
// 常量
// ========================

const isWebGLAvailable = (): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canvas = document.createElement('canvas') as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!(window as any).WebGLRenderingContext && !!gl;
  } catch {
    return false;
  }
};

const isLowEndDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canvas = document.createElement('canvas') as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return true;
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      const lowEndKeywords = ['mali-4', 'adreno 3', 'adreno 4', 'powervr sgx', 'intel hd graphics'];
      return lowEndKeywords.some((k: string) => (renderer as string).toLowerCase().includes(k));
    }
  } catch {
    // 无法检测时保守降级
  }
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

// ========================
// 相机控制器（鼠标视差）
// ========================

function ParallaxCamera() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const isDev = process.env.NODE_ENV === 'development';

  // 开发模式订阅 store，生产模式不需要
  const camX = useSceneStore(s => s.camera.positionX);
  const camY = useSceneStore(s => s.camera.positionY);
  const lookX = useSceneStore(s => s.camera.lookAtX);
  const lookY = useSceneStore(s => s.camera.lookAtY);
  const lookZ = useSceneStore(s => s.camera.lookAtZ);
  const parallaxEnabled = useSceneStore(s => s.parallax.enabled);
  const parallaxX = useSceneStore(s => s.parallax.intensityX);
  const parallaxY = useSceneStore(s => s.parallax.intensityY);
  const parallaxSmooth = useSceneStore(s => s.parallax.smoothness);

  // 生产模式默认值
  const d = PRODUCTION_DEFAULTS;
  const pCamX = isDev ? camX : d.camera.positionX;
  const pCamY = isDev ? camY : d.camera.positionY;
  const pLookX = isDev ? lookX : d.camera.lookAtX;
  const pLookY = isDev ? lookY : d.camera.lookAtY;
  const pLookZ = isDev ? lookZ : d.camera.lookAtZ;
  const pEnabled = isDev ? parallaxEnabled : d.parallax.enabled;
  const pX = isDev ? parallaxX : d.parallax.intensityX;
  const pY = isDev ? parallaxY : d.parallax.intensityY;
  const pSmooth = isDev ? parallaxSmooth : d.parallax.smoothness;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useFrame(() => {
    if (!pEnabled) return;

    target.current.x += (mouse.current.x - target.current.x) * pSmooth;
    target.current.y += (mouse.current.y - target.current.y) * pSmooth;

    camera.position.x = pCamX + target.current.x * pX;
    camera.position.y = pCamY + target.current.y * pY;
    camera.lookAt(pLookX, pLookY, pLookZ);
  });

  return null;
}

// ========================
// 后处理
// ========================

function PostProcessing() {
  const isDev = process.env.NODE_ENV === 'development';

  const bloomThreshold = useSceneStore(s => s.postProcessing.bloomThreshold);
  const bloomSmoothing = useSceneStore(s => s.postProcessing.bloomSmoothing);
  const bloomIntensity = useSceneStore(s => s.postProcessing.bloomIntensity);
  const vignetteDarkness = useSceneStore(s => s.postProcessing.vignetteDarkness);

  return (
    <EffectComposer>
      <Bloom
        luminanceThreshold={isDev ? bloomThreshold : PRODUCTION_DEFAULTS.postProcessing.bloomThreshold}
        luminanceSmoothing={isDev ? bloomSmoothing : PRODUCTION_DEFAULTS.postProcessing.bloomSmoothing}
        intensity={isDev ? bloomIntensity : PRODUCTION_DEFAULTS.postProcessing.bloomIntensity}
        mipmapBlur
      />
      <Vignette
        eskil={false}
        offset={0.1}
        darkness={isDev ? vignetteDarkness : PRODUCTION_DEFAULTS.postProcessing.vignetteDarkness}
      />
    </EffectComposer>
  );
}

// ========================
// 加载中占位
// ========================

function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a1a]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00f0ff] border-t-transparent" />
        <p className="text-[#00f0ff]/70 text-sm font-mono">INITIALIZING...</p>
      </div>
    </div>
  );
}

// ========================
// 错误回退
// ========================

function ErrorFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a1a]">
      <p className="text-[#ff0066]/70 text-sm font-mono">RENDER ERROR</p>
    </div>
  );
}

// ========================
// 3D 场景内容
// ========================

function Scene() {
  const isDev = process.env.NODE_ENV === 'development';

  // Zustand selector - 只有对应字段变化时才重渲染
  const useOrbit = useSceneStore(s => s.controls.useOrbit);
  const showRain = useSceneStore(s => s.elements.showRain);
  const showFurniture = useSceneStore(s => s.elements.showFurniture);
  const showRoom = useSceneStore(s => s.elements.showRoom);
  const showGrid = useSceneStore(s => s.elements.showGrid);

  const pUseOrbit = isDev ? useOrbit : false;
  const pShowRain = isDev ? showRain : true;
  const pShowFurniture = isDev ? showFurniture : true;
  const pShowRoom = isDev ? showRoom : true;
  const pShowGrid = isDev ? showGrid : false;

  return (
    <>
      {!pUseOrbit && <ParallaxCamera />}
      {pUseOrbit && (
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          minDistance={2}
          maxDistance={15}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2}
          target={[0, 1.2, 0]}
        />
      )}
      <CyberpunkLights />
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
      {pShowRoom && <Room />}
      {pShowFurniture && <Furniture />}
      {pShowRain && <RainEffect />}
      <PostProcessing />
    </>
  );
}

// ========================
// 滚动淡出遮罩
// ========================

function ScrollFadeOverlay({ scrollProgress }: { scrollProgress: number }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none bg-[#0a0a1a] transition-opacity duration-100"
      style={{ opacity: Math.min(scrollProgress * 2, 1) }}
    />
  );
}

// ========================
// 主组件
// ========================

export default function CyberpunkBanner() {
  const [webglOk, setWebglOk] = useState(true);
  const [lowEnd, setLowEnd] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const isDev = process.env.NODE_ENV === 'development';

  const camPosX = useSceneStore(s => s.camera.positionX);
  const camPosY = useSceneStore(s => s.camera.positionY);
  const camPosZ = useSceneStore(s => s.camera.positionZ);
  const cameraFov = useSceneStore(s => s.camera.fov);

  const cameraPos: [number, number, number] = isDev
    ? [camPosX, camPosY, camPosZ]
    : [PRODUCTION_DEFAULTS.camera.positionX, PRODUCTION_DEFAULTS.camera.positionY, PRODUCTION_DEFAULTS.camera.positionZ];
  const fov = isDev ? cameraFov : PRODUCTION_DEFAULTS.camera.fov;

  useEffect(() => {
    if (!isWebGLAvailable()) {
      setWebglOk(false);
      return;
    }
    if (isLowEndDevice()) {
      setLowEnd(true);
    }
  }, []);

  useEffect(() => {
    if (isDev) {
      renderDevControls();
    }
  }, [isDev]);

  useEffect(() => {
    const handleScroll = () => {
      const progress = Math.max(0, window.scrollY / window.innerHeight);
      setScrollProgress(progress);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCreated = useCallback(() => {
    setSceneReady(true);
  }, []);

  if (!webglOk || lowEnd) {
    return (
      <div className="relative snap-start h-screen bg-[#0a0a1a]">
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-[#00f0ff]/30 text-lg font-mono tracking-widest">
            3D 场景加载中...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative snap-start h-screen overflow-hidden bg-[#0a0a1a]">
      <div className="absolute inset-0" style={{ opacity: sceneReady ? 1 : 0, transition: 'opacity 1s ease' }}>
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
            <Scene />
          </Suspense>
        </Canvas>
      </div>

      {!sceneReady && !hasError && <LoadingFallback />}
      {hasError && <ErrorFallback />}
      <ScrollFadeOverlay scrollProgress={scrollProgress} />

      <div
        onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
        className="absolute bottom-4 left-0 right-0 cursor-pointer text-center text-[#00f0ff]/60 animate-bounce z-10"
      >
        <DownOutlined className="text-4xl" />
      </div>
    </div>
  );
}
