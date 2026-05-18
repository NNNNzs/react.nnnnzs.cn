/**
 * 开发调试控件面板（Zustand 版）
 * - 选择光源后显示该光源的详细参数面板
 * - 预设视角仅视差模式下有效
 * - 两种控制模式互斥
 */

'use client';

import { createRoot } from 'react-dom/client';
import React, { useState } from 'react';
import { useControls, button, folder } from 'leva';
import { useSceneStore } from './useSceneStore';

const LIGHT_OPTIONS = {
  '环境光': 'ambient',
  '窗外主光': 'window',
  '显示器光': 'monitor',
  '服务器光': 'server',
  '霓虹招牌': 'neonSign',
  '天花板青光': 'ceilingCyan',
  '天花板紫光': 'ceilingPurple',
};

function updateLight(field: string, value: number | string) {
  const store = useSceneStore.getState();
  store.set({ lights: { ...store.lights, [field]: value } as any });
}

// ========================
// 光源选择器
// ========================

function LightSelector({ onSelect }: { onSelect: (key: string) => void }) {
  useControls('💡 选择光源', {
    '光源': {
      value: 'window' as string,
      options: LIGHT_OPTIONS,
      onChange: (v: string) => onSelect(v),
    },
  });
  return null;
}

// ========================
// 环境光面板
// ========================

function AmbientPanel() {
  const store = useSceneStore.getState().lights;
  useControls('💡 环境光参数', {
    '强度': { value: store.ambientIntensity, min: 0, max: 5, step: 0.01, onChange: (v) => updateLight('ambientIntensity', v) },
    '颜色': { value: store.ambientColor, onChange: (v) => updateLight('ambientColor', v) },
  });
  return null;
}

// ========================
// 窗外主光面板（SpotLight）
// ========================

function WindowPanel() {
  const store = useSceneStore.getState().lights;
  useControls('💡 窗外主光参数', {
    '强度': { value: store.windowIntensity, min: 0, max: 10, step: 0.1, onChange: (v) => updateLight('windowIntensity', v) },
    '颜色': { value: store.windowColor, onChange: (v) => updateLight('windowColor', v) },
    '锥角': { value: store.windowAngle, min: 0.1, max: Math.PI, step: 0.01, onChange: (v) => updateLight('windowAngle', v) },
    '边缘柔化': { value: store.windowPenumbra, min: 0, max: 1, step: 0.01, onChange: (v) => updateLight('windowPenumbra', v) },
    '衰减': { value: store.windowDecay, min: 0.1, max: 5, step: 0.1, onChange: (v) => updateLight('windowDecay', v) },
  });
  return null;
}

// ========================
// 点光源通用面板
// ========================

function PointLightPanel({ name, prefix }: { name: string; prefix: string }) {
  const store = useSceneStore.getState().lights;
  const f = (field: string) => `${prefix}${field}` as keyof typeof store;
  useControls(`💡 ${name}参数`, {
    '强度': { value: store[f('Intensity')] as number, min: 0, max: 10, step: 0.1, onChange: (v) => updateLight(f('Intensity'), v) },
    '颜色': { value: store[f('Color')] as string, onChange: (v) => updateLight(f('Color'), v) },
    '照射距离': { value: store[f('Distance')] as number, min: 0, max: 20, step: 0.5, onChange: (v) => updateLight(f('Distance'), v) },
    '衰减': { value: store[f('Decay')] as number, min: 0.1, max: 5, step: 0.1, onChange: (v) => updateLight(f('Decay'), v) },
  });
  return null;
}

// ========================
// 光源编辑器
// ========================

function LightEditor({ selected }: { selected: string }) {
  switch (selected) {
    case 'ambient': return <AmbientPanel />;
    case 'window': return <WindowPanel />;
    case 'monitor': return <PointLightPanel name="显示器" prefix="monitor" />;
    case 'server': return <PointLightPanel name="服务器" prefix="server" />;
    case 'neonSign': return <PointLightPanel name="霓虹招牌" prefix="neonSign" />;
    case 'ceilingCyan': return <PointLightPanel name="天花板青光" prefix="ceilingCyan" />;
    case 'ceilingPurple': return <PointLightPanel name="天花板紫光" prefix="ceilingPurple" />;
    default: return null;
  }
}

// ========================
// 相机预设视角
// ========================

function CameraPresets() {
  const presets = {
    '默认入口视角': { x: 0, y: 2.5, z: 6.5 },
    '正面广角': { x: 0, y: 2, z: 10 },
    '左侧视角': { x: -4, y: 2.5, z: 3 },
    '右侧视角': { x: 4, y: 2.5, z: 3 },
    '俯视视角': { x: 0, y: 6, z: 2 },
    '鸟瞰视角': { x: 0, y: 8, z: 0.1 },
    '窗户特写': { x: 0, y: 1.5, z: 0 },
    '工作区特写': { x: 1.2, y: 1.3, z: -0.5 },
  };

  useControls('🎯 预设视角（仅视差模式）', {
    ...Object.fromEntries(
      Object.entries(presets).map(([name, pos]) => [
        name,
        button(() => {
          const { camera, parallax } = useSceneStore.getState();
          if (!parallax.enabled) return;
          useSceneStore.getState().set({
            camera: { ...camera, positionX: pos.x, positionY: pos.y, positionZ: pos.z },
          });
        }),
      ])
    ),
  });
  return null;
}

// ========================
// 主面板
// ========================

function DevPanel() {
  const [selectedLight, setSelectedLight] = useState('window');

  useControls('🎮 控制模式', folder({
    'Parallax 视差模式': {
      value: !useSceneStore.getState().controls.useOrbit,
      onChange: (v) => useSceneStore.getState().set({
        controls: { useOrbit: !v },
        parallax: { enabled: v, intensityX: 0.2, intensityY: 0.1, smoothness: 0.05 },
      }),
    },
  }) as any);

  useControls('📷 相机微调', folder({
    '位置 X': {
      value: useSceneStore.getState().camera.positionX,
      min: -5, max: 5, step: 0.1,
      onChange: (v) => useSceneStore.getState().set({ camera: { ...useSceneStore.getState().camera, positionX: v } }),
    },
    '位置 Y': {
      value: useSceneStore.getState().camera.positionY,
      min: 0, max: 8, step: 0.1,
      onChange: (v) => useSceneStore.getState().set({ camera: { ...useSceneStore.getState().camera, positionY: v } }),
    },
    '位置 Z': {
      value: useSceneStore.getState().camera.positionZ,
      min: 2, max: 15, step: 0.1,
      onChange: (v) => useSceneStore.getState().set({ camera: { ...useSceneStore.getState().camera, positionZ: v } }),
    },
    '视野 FOV': {
      value: useSceneStore.getState().camera.fov,
      min: 30, max: 120, step: 1,
      onChange: (v) => useSceneStore.getState().set({ camera: { ...useSceneStore.getState().camera, fov: v } }),
    },
  }) as any);

  useControls('👁️ 视差强度', folder({
    'X 轴强度': {
      value: useSceneStore.getState().parallax.intensityX,
      min: 0, max: 1, step: 0.01,
      onChange: (v) => useSceneStore.getState().set({ parallax: { ...useSceneStore.getState().parallax, intensityX: v } }),
    },
    'Y 轴强度': {
      value: useSceneStore.getState().parallax.intensityY,
      min: 0, max: 1, step: 0.01,
      onChange: (v) => useSceneStore.getState().set({ parallax: { ...useSceneStore.getState().parallax, intensityY: v } }),
    },
  }) as any);

  useControls('✨ 后处理', folder({
    'Bloom 强度': {
      value: useSceneStore.getState().postProcessing.bloomIntensity,
      min: 0, max: 5, step: 0.1,
      onChange: (v) => useSceneStore.getState().set({ postProcessing: { ...useSceneStore.getState().postProcessing, bloomIntensity: v } }),
    },
    'Bloom 阈值': {
      value: useSceneStore.getState().postProcessing.bloomThreshold,
      min: 0, max: 1, step: 0.01,
      onChange: (v) => useSceneStore.getState().set({ postProcessing: { ...useSceneStore.getState().postProcessing, bloomThreshold: v } }),
    },
    '晕影暗度': {
      value: useSceneStore.getState().postProcessing.vignetteDarkness,
      min: 0, max: 2, step: 0.1,
      onChange: (v) => useSceneStore.getState().set({ postProcessing: { ...useSceneStore.getState().postProcessing, vignetteDarkness: v } }),
    },
  }) as any);

  useControls('🧩 场景元素', folder({
    '显示雨滴': {
      value: useSceneStore.getState().elements.showRain,
      onChange: (v) => useSceneStore.getState().set({ elements: { ...useSceneStore.getState().elements, showRain: v } }),
    },
    '显示家具': {
      value: useSceneStore.getState().elements.showFurniture,
      onChange: (v) => useSceneStore.getState().set({ elements: { ...useSceneStore.getState().elements, showFurniture: v } }),
    },
    '显示房间': {
      value: useSceneStore.getState().elements.showRoom,
      onChange: (v) => useSceneStore.getState().set({ elements: { ...useSceneStore.getState().elements, showRoom: v } }),
    },
    '显示网格线': {
      value: useSceneStore.getState().elements.showGrid,
      onChange: (v) => useSceneStore.getState().set({ elements: { ...useSceneStore.getState().elements, showGrid: v } }),
    },
  }) as any);

  useControls('🔄 全局操作', folder({
    '_重置所有设置': button(() => { useSceneStore.getState().reset(); }),
    '_导出配置到控制台': button(() => {
      console.log('=== 赛博朋克 3D 场景配置 ===');
      console.log(JSON.stringify(useSceneStore.getState(), null, 2));
    }),
  }) as any);

  return (
    <>
      <CameraPresets />
      <LightSelector onSelect={setSelectedLight} />
      <LightEditor key={selectedLight} selected={selectedLight} />
    </>
  );
}

// ========================
// 渲染入口
// ========================

export function renderDevControls() {
  if (process.env.NODE_ENV !== 'development') return null;

  const existingContainer = document.getElementById('dev-controls-root');
  if (existingContainer) return;

  const container = document.createElement('div');
  container.id = 'dev-controls-root';
  document.body.appendChild(container);

  createRoot(container).render(<DevPanel />);
}
