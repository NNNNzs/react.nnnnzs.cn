'use client';

export type HomepageSceneVariant = 'day' | 'night';

export interface HomepageThemePreset {
  variant: HomepageSceneVariant;
  background: string;
  overlay: 'minimal' | 'hud';
  weather: 'clear' | 'rain';
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
    postProcessing: {
      bloomThreshold: 0.55,
      bloomSmoothing: 0.8,
      bloomIntensity: 0.18,
      vignetteDarkness: 0.18,
    },
    camera: {
      position: [0, 2.35, 6.4],
      fov: 72,
    },
  },
  night: {
    variant: 'night',
    background: '#050611',
    overlay: 'hud',
    weather: 'rain',
    postProcessing: {
      bloomThreshold: 0.2,
      bloomSmoothing: 0.9,
      bloomIntensity: 1.5,
      vignetteDarkness: 0.8,
    },
    camera: {
      position: [0, 2.5, 6.5],
      fov: 75,
    },
  },
};
