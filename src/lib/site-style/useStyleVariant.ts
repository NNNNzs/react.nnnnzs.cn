'use client';

import { useDarkMode } from '@/hooks/useDarkMode';
import { getStyleVariantFromThemeMode } from './variant';
import type { SiteStyleVariant } from './variant';

export function useStyleVariant(): SiteStyleVariant {
  const { isDark } = useDarkMode();
  return getStyleVariantFromThemeMode(isDark ? 'dark' : 'light');
}
