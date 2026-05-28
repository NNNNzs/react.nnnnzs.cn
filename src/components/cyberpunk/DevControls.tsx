/**
 * 开发调试控件面板（Zustand 版）
 * - 选择光源后显示该光源的详细参数面板
 * - 预设视角仅视差模式下有效
 * - 两种控制模式互斥
 */

'use client';

import { createRoot, type Root } from 'react-dom/client';
import React, { useState } from 'react';
import { useControls, button } from 'leva';
import { useSceneStore, type SceneConfig } from './useSceneStore';
import { SCENE_EDITOR_TARGETS, useSceneEditorStore, type SceneEditorMode, type SceneEditorTargetId } from './sceneEditor';

type LightConfig = SceneConfig['lights'];

const LIGHT_OPTIONS = {
  '环境光': 'ambient',
  '窗外主光': 'window',
  '显示器光': 'monitor',
  '服务器光': 'server',
  '霓虹招牌': 'neonSign',
  '天花板青光': 'ceilingCyan',
  '天花板紫光': 'ceilingPurple',
};

function updateLight(field: keyof LightConfig, value: number | string) {
  const store = useSceneStore.getState();
  store.set({ lights: { ...store.lights, [field]: value } });
}

const LIGHT_OPTIONS_WITH_EXTERIOR = {
  ...LIGHT_OPTIONS,
  '窗外射入光': 'exteriorWindow',
};

// ========================
// 光源选择器
// ========================

function LightSelector({ onSelect }: { onSelect: (key: string) => void }) {
  useControls('💡 选择光源', {
    '光源': {
      value: 'window' as string,
      options: LIGHT_OPTIONS_WITH_EXTERIOR,
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

type PointLightPrefix = 'exteriorWindow' | 'monitor' | 'server' | 'neonSign' | 'ceilingCyan' | 'ceilingPurple';

function PointLightPanel({ name, prefix }: { name: string; prefix: PointLightPrefix }) {
  const store = useSceneStore.getState().lights;
  const f = (field: 'Intensity' | 'Color' | 'Distance' | 'Decay') => `${prefix}${field}` as keyof typeof store;
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
    case 'exteriorWindow': return <PointLightPanel name="窗外射入光" prefix="exteriorWindow" />;
    case 'monitor': return <PointLightPanel name="显示器" prefix="monitor" />;
    case 'server': return <PointLightPanel name="服务器" prefix="server" />;
    case 'neonSign': return <PointLightPanel name="霓虹招牌" prefix="neonSign" />;
    case 'ceilingCyan': return <PointLightPanel name="天花板青光" prefix="ceilingCyan" />;
    case 'ceilingPurple': return <PointLightPanel name="天花板紫光" prefix="ceilingPurple" />;
    default: return null;
  }
}

// ========================
// 鍦烘櫙鍏冪礌鎿嶄綔闈㈡澘
// ========================

function SceneEditorPanel() {
  const selectedId = useSceneEditorStore((s) => s.selectedId);
  const setSelectedId = useSceneEditorStore((s) => s.setSelectedId);
  const mode = useSceneEditorStore((s) => s.mode);
  const setMode = useSceneEditorStore((s) => s.setMode);

  const targetOptions = Object.fromEntries(
    SCENE_EDITOR_TARGETS.map((item) => [item.label, item.id]),
  ) as Record<string, SceneEditorTargetId>;

  useControls('🧩 模型变换', {
    '选中对象': {
      value: selectedId ?? SCENE_EDITOR_TARGETS[0].id,
      options: targetOptions,
      onChange: (v: SceneEditorTargetId) => setSelectedId(v),
    },
    '工具模式': {
      value: mode,
      options: {
        '移动': 'translate',
        '旋转': 'rotate',
        '缩放': 'scale',
      },
      onChange: (v: SceneEditorMode) => setMode(v),
    },
    '清除选择': button(() => setSelectedId(null)),
  });

  return null;
}

// ========================
// 相机预设视角
// ========================

function CameraPresets() {
  const presets = {
    '参考图默认视角': { x: -2.85, y: 2.2, z: 2.9 },
    '正面广角': { x: -0.2, y: 2.05, z: 3.95 },
    '左窗工作区': { x: -0.65, y: 1.8, z: 1.15 },
    '中央客厅': { x: 2.0, y: 2.0, z: 2.45 },
    '东墙设备区': { x: 0.95, y: 1.8, z: 0.42 },
    '右侧睡眠区': { x: -0.75, y: 1.75, z: 2.5 },
    '俯视视角': { x: 0, y: 6.2, z: 2.0 },
    '鸟瞰视角': { x: 0, y: 7.2, z: 0.1 },
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

  useControls('🎮 控制模式', {
    'Parallax 视差模式': {
      value: !useSceneStore.getState().controls.useOrbit,
      onChange: (v) => useSceneStore.getState().set({
        controls: { useOrbit: !v },
        parallax: { enabled: v, intensityX: 0.2, intensityY: 0.1, smoothness: 0.05 },
      }),
    },
  });

  useControls('📷 相机微调', {
    '位置 X': {
      value: useSceneStore.getState().camera.positionX,
      min: -6, max: 6, step: 0.1,
      onChange: (v) => useSceneStore.getState().set({ camera: { ...useSceneStore.getState().camera, positionX: v } }),
    },
    '位置 Y': {
      value: useSceneStore.getState().camera.positionY,
      min: 0, max: 7, step: 0.1,
      onChange: (v) => useSceneStore.getState().set({ camera: { ...useSceneStore.getState().camera, positionY: v } }),
    },
    '位置 Z': {
      value: useSceneStore.getState().camera.positionZ,
      min: -5, max: 9, step: 0.1,
      onChange: (v) => useSceneStore.getState().set({ camera: { ...useSceneStore.getState().camera, positionZ: v } }),
    },
    '视野 FOV': {
      value: useSceneStore.getState().camera.fov,
      min: 30, max: 120, step: 1,
      onChange: (v) => useSceneStore.getState().set({ camera: { ...useSceneStore.getState().camera, fov: v } }),
    },
  });

  useControls('👁️ 视差强度', {
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
  });

  useControls('✨ 后处理', {
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
  });

  useControls('🧩 场景元素', {
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
  });

  useControls('🔄 全局操作', {
    '_重置所有设置': button(() => { useSceneStore.getState().reset(); }),
    '_导出配置到控制台': button(() => {
      console.log('=== 赛博朋克 3D 场景配置 ===');
      console.log(JSON.stringify(useSceneStore.getState(), null, 2));
    }),
  });

  return (
    <>
      <CameraPresets />
      <LightSelector onSelect={setSelectedLight} />
      <SceneEditorPanel />
      <LightEditor key={selectedLight} selected={selectedLight} />
    </>
  );
}

// ========================
// 渲染入口
// ========================

let devControlsRoot: Root | null = null;

export function renderDevControls() {
  const existingContainer = document.getElementById('dev-controls-root');
  if (existingContainer) return;

  const container = document.createElement('div');
  container.id = 'dev-controls-root';
  document.body.appendChild(container);

  devControlsRoot = createRoot(container);
  devControlsRoot.render(<DevPanel />);
}

export function destroyDevControls() {
  const existingContainer = document.getElementById('dev-controls-root');
  if (!existingContainer) return;

  devControlsRoot?.unmount();
  devControlsRoot = null;
  existingContainer.remove();
}
