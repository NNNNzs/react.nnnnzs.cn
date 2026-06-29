export type ThemeMode = 'light' | 'dark';

export type SiteStyleVariant = 'day' | 'night';

export const SITE_STYLE_VARIANTS = ['day', 'night'] as const satisfies readonly SiteStyleVariant[];

export const DEFAULT_SITE_STYLE_VARIANT: SiteStyleVariant = 'day';

export function getStyleVariantFromThemeMode(mode: ThemeMode): SiteStyleVariant {
  return mode === 'dark' ? 'night' : 'day';
}

export function getThemeModeFromStyleVariant(variant: SiteStyleVariant): ThemeMode {
  return variant === 'night' ? 'dark' : 'light';
}

export function isSiteStyleVariant(value: unknown): value is SiteStyleVariant {
  return value === 'day' || value === 'night';
}

export function parseSiteStyleVariant(value: unknown): SiteStyleVariant {
  return isSiteStyleVariant(value) ? value : DEFAULT_SITE_STYLE_VARIANT;
}
