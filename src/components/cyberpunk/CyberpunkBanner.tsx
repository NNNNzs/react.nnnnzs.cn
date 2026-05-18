/**
 * 赛博朋克 3D Banner
 * 替换首页的静态背景图，展示一个有生活感的赛博朋克小公寓房间
 *
 * 功能：
 * - 3D 房间场景（地板/墙/天花/窗户）
 * - Bloom 霓虹发光后处理
 * - 窗户雨滴效果
 * - 鼠标视差
 * - 滚动淡出过渡
 * - 低端设备降级（回退到静态背景）
 */

'use client';

import React, { Suspense, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { DownOutlined } from '@ant-design/icons';
import * as THREE from 'three';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import Room from './Room';
import RainEffect from './RainEffect';
import Furniture from './Furniture';
import CyberpunkLights from './CyberpunkLights';

// ========================
// 类型定义
// ========================

interface CyberpunkBannerProps {
  anchorRef?: React.RefObject<HTMLDivElement | null>;
}

// ========================
// 常量
// ========================

/** 检测 WebGL 支持 */
function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

/** 检测是否为低端设备（移动端或低端 GPU） */
function isLowEndDevice(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return true;
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      // 常见低端 GPU 关键字
      const lowEndKeywords = ['mali-4', 'adreno 3', 'adreno 4', 'powervr sgx', 'intel hd graphics'];
      return lowEndKeywords.some(k => renderer.toLowerCase().includes(k));
    }
  } catch {
    // 无法检测时保守降级
  }
  // 无法检测时，移动端保守降级
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// ========================
// 相机控制器（鼠标视差）
// ========================

function ParallaxCamera() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 归一化到 [-1, 1]
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useFrame(() => {
    // 平滑插值
    target.current.x += (mouse.current.x - target.current.x) * 0.05;
    target.current.y += (mouse.current.y - target.current.y) * 0.05;

    // 基础相机位置 + 视差偏移
    camera.position.x = target.current.x * 0.3;
    camera.position.y = 2.2 + target.current.y * 0.15;
    camera.lookAt(0, 1.2, -1);
  });

  return null;
}

// ========================
// 后处理
// ========================

function PostProcessing() {
  return (
    <EffectComposer>
      <Bloom
        luminanceThreshold={0.2}
        luminanceSmoothing={0.9}
        intensity={1.5}
        mipmapBlur
      />
      <Vignette eskil={false} offset={0.1} darkness={0.8} />
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
  return (
    <>
      <ParallaxCamera />
      <CyberpunkLights />
      <Room />
      <Furniture />
      <RainEffect />
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

export default function CyberpunkBanner({ anchorRef }: CyberpunkBannerProps) {
  const [webglOk, setWebglOk] = useState(true);
  const [lowEnd, setLowEnd] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollRestoreRef = useRef(false);

  // 检测环境
  useEffect(() => {
    if (!isWebGLAvailable()) {
      setWebglOk(false);
      return;
    }
    if (isLowEndDevice()) {
      setLowEnd(true);
    }
  }, []);

  // 滚动监听
  useEffect(() => {
    const handleScroll = () => {
      const progress = Math.max(0, window.scrollY / window.innerHeight);
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 自动滚到文章列表（和原 Banner 保持一致）
  const scrollIntoPost = useCallback(() => {
    if (anchorRef?.current) {
      anchorRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [anchorRef]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.scrollY === 0) {
        scrollIntoPost();
      }
    }, 2000); // 3D 场景需要多给点时间加载

    return () => clearTimeout(timer);
  }, [scrollIntoPost]);

  // 场景加载完成
  const handleCreated = useCallback(() => {
    setSceneReady(true);
  }, []);

  // 低端设备回退：静态深色背景
  if (!webglOk || lowEnd) {
    return (
      <div className="relative snap-start h-screen bg-[#0a0a1a]">
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-[#00f0ff]/50 text-lg font-mono tracking-widest">
            记录技术，分享生活
          </p>
        </div>
        <div
          onClick={scrollIntoPost}
          className="absolute bottom-4 left-0 right-0 cursor-pointer text-center text-[#00f0ff]/50 animate-bounce z-10"
        >
          <DownOutlined className="text-4xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative snap-start h-screen overflow-hidden bg-[#0a0a1a]">
      {/* 3D Canvas */}
      <div className="absolute inset-0" style={{ opacity: sceneReady ? 1 : 0, transition: 'opacity 1s ease' }}>
        <Canvas
          camera={{
            position: [0, 2.2, 6],
            fov: 65,
            near: 0.1,
            far: 100,
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

      {/* 加载占位 */}
      {!sceneReady && !hasError && <LoadingFallback />}
      {hasError && <ErrorFallback />}

      {/* 滚动淡出 */}
      <ScrollFadeOverlay scrollProgress={scrollProgress} />

      {/* 底部标题 */}
      <div className="absolute bottom-16 left-0 right-0 text-center z-10 pointer-events-none">
        <p
          className="text-white/80 text-xl font-mono tracking-wider"
          style={{ textShadow: '0 0 20px rgba(0,240,255,0.5), 0 0 40px rgba(0,240,255,0.2)' }}
        >
          记录技术，分享生活
        </p>
      </div>

      {/* 滚动提示 */}
      <div
        onClick={scrollIntoPost}
        className="absolute bottom-4 left-0 right-0 cursor-pointer text-center text-[#00f0ff]/60 animate-bounce z-10"
      >
        <DownOutlined className="text-4xl" />
      </div>
    </div>
  );
}
