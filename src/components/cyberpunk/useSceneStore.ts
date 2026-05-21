/**
 * 赛博朋克场景 Zustand Store
 * 灯光参数按光源分组，支持精细调节
 */

import { create } from 'zustand';

export interface SceneConfig {
  camera: {
    positionX: number;
    positionY: number;
    positionZ: number;
    lookAtX: number;
    lookAtY: number;
    lookAtZ: number;
    fov: number;
  };
  controls: {
    useOrbit: boolean;
  };
  parallax: {
    enabled: boolean;
    intensityX: number;
    intensityY: number;
    smoothness: number;
  };
  lights: {
    // 环境光
    ambientIntensity: number;
    ambientColor: string;
    // 窗外主光 SpotLight
    windowIntensity: number;
    windowColor: string;
    windowAngle: number;
    windowPenumbra: number;
    windowDecay: number;
    // 窗外夜间射入房间的独立光源
    exteriorWindowIntensity: number;
    exteriorWindowColor: string;
    exteriorWindowDistance: number;
    exteriorWindowDecay: number;
    // 显示器冷蓝光
    monitorIntensity: number;
    monitorColor: string;
    monitorDistance: number;
    monitorDecay: number;
    // 服务器紫光
    serverIntensity: number;
    serverColor: string;
    serverDistance: number;
    serverDecay: number;
    // 霓虹招牌
    neonSignIntensity: number;
    neonSignColor: string;
    neonSignDistance: number;
    neonSignDecay: number;
    // 天花板青光
    ceilingCyanIntensity: number;
    ceilingCyanColor: string;
    ceilingCyanDistance: number;
    ceilingCyanDecay: number;
    // 天花板紫光
    ceilingPurpleIntensity: number;
    ceilingPurpleColor: string;
    ceilingPurpleDistance: number;
    ceilingPurpleDecay: number;
  };
  postProcessing: {
    bloomThreshold: number;
    bloomSmoothing: number;
    bloomIntensity: number;
    vignetteDarkness: number;
  };
  elements: {
    showRain: boolean;
    showFurniture: boolean;
    showRoom: boolean;
    showGrid: boolean;
  };
}

const DEFAULT_CONFIG: SceneConfig = {
  camera: {
    positionX: 0, positionY: 2.5, positionZ: 6.5,
    lookAtX: 0, lookAtY: 1.0, lookAtZ: -2, fov: 75,
  },
  controls: { useOrbit: true },
  parallax: {
    enabled: false, intensityX: 0.2, intensityY: 0.1, smoothness: 0.05,
  },
  lights: {
    ambientIntensity: 0.08, ambientColor: '#ffffff',
    windowIntensity: 3.5, windowColor: '#4466aa', windowAngle: 0.8, windowPenumbra: 0.6, windowDecay: 1.5,
    exteriorWindowIntensity: 4.2, exteriorWindowColor: '#66ccff', exteriorWindowDistance: 9, exteriorWindowDecay: 1.4,
    monitorIntensity: 2.5, monitorColor: '#0088cc', monitorDistance: 4, monitorDecay: 2,
    serverIntensity: 1.5, serverColor: '#6644cc', serverDistance: 3, serverDecay: 2,
    neonSignIntensity: 2.0, neonSignColor: '#cc0055', neonSignDistance: 5, neonSignDecay: 2,
    ceilingCyanIntensity: 0.3, ceilingCyanColor: '#0066aa', ceilingCyanDistance: 5, ceilingCyanDecay: 2,
    ceilingPurpleIntensity: 0.2, ceilingPurpleColor: '#5533aa', ceilingPurpleDistance: 4, ceilingPurpleDecay: 2,
  },
  postProcessing: {
    bloomThreshold: 0.2, bloomSmoothing: 0.9, bloomIntensity: 1.5, vignetteDarkness: 0.8,
  },
  elements: { showRain: true, showFurniture: true, showRoom: true, showGrid: false },
};

interface SceneStore extends SceneConfig {
  set: (partial: Partial<SceneConfig>) => void;
  reset: () => void;
}

export const useSceneStore = create<SceneStore>((set) => ({
  ...structuredClone(DEFAULT_CONFIG),
  set: (partial) => set(partial),
  reset: () => set(structuredClone(DEFAULT_CONFIG)),
}));

// 生产环境默认值
export const PRODUCTION_DEFAULTS = DEFAULT_CONFIG;
