'use client';

export type HomepageSceneVariant = 'day' | 'night';

export interface HomepageThemePreset {
  variant: HomepageSceneVariant;
  background: string;
  overlay: 'minimal' | 'hud';
  weather: 'clear' | 'rain';
  scene: {
    fogColor: string;
    fogNear: number;
    fogFar: number;
    wallColor: string;
    floorColor: string;
    floorRoughness: number;
    floorMetalness: number;
  };
  postProcessing: {
    bloomThreshold: number;
    bloomSmoothing: number;
    bloomIntensity: number;
    vignetteDarkness: number;
  };
  camera: {
    position: [number, number, number];
    fov: number;
  };
}

export const HOMEPAGE_THEME_PRESETS: Record<HomepageSceneVariant, HomepageThemePreset> = {
  day: {
    variant: 'day',
    background: '#f8fafc',
    overlay: 'minimal',
    weather: 'clear',
    scene: {
      fogColor: '#f8fafc',
      fogNear: 12,
      fogFar: 28,
      wallColor: '#f1f5f9',
      floorColor: '#b58b5f',
      floorRoughness: 0.82,
      floorMetalness: 0.04,
    },
    postProcessing: {
      bloomThreshold: 0.62,
      bloomSmoothing: 0.8,
      bloomIntensity: 0.12,
      vignetteDarkness: 0.12,
    },
    camera: {
      position: [-2.85, 2.2, 2.9],
      fov: 68,
    },
  },
  night: {
    variant: 'night',
    background: '#050611',
    overlay: 'hud',
    weather: 'rain',
    scene: {
      fogColor: '#050611',
      fogNear: 8,
      fogFar: 19,
      wallColor: '#0d0d1a',
      floorColor: '#121218',
      floorRoughness: 0.65,
      floorMetalness: 0.35,
    },
    postProcessing: {
      bloomThreshold: 0.06,
      bloomSmoothing: 0.85,
      bloomIntensity: 2.4,
      vignetteDarkness: 0.8,
    },
    camera: {
      position: [-2.85, 2.2, 2.9],
      fov: 68,
    },
  },
};
