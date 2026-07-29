import 'server-only';

import { unstable_cache } from 'next/cache';
import { configByKeys } from '@/services/config';

export const COLLECTION_HOME_BACKGROUND_KEYS = {
  day: 'collections.home.background.day',
  night: 'collections.home.background.night',
} as const;

export interface CollectionHomeVisualConfig {
  day?: string;
  night?: string;
}

/** 判断配置变更是否会影响合集首页视觉。 */
export function isCollectionHomeVisualKey(key: unknown): boolean {
  return typeof key === 'string'
    && Object.values(COLLECTION_HOME_BACKGROUND_KEYS).includes(
      key as typeof COLLECTION_HOME_BACKGROUND_KEYS[keyof typeof COLLECTION_HOME_BACKGROUND_KEYS],
    );
}

function parseHttpsUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

const getCachedCollectionHomeVisualConfig = unstable_cache(
  async (): Promise<CollectionHomeVisualConfig> => {
    const configs = await configByKeys(Object.values(COLLECTION_HOME_BACKGROUND_KEYS));
    const day = configs[COLLECTION_HOME_BACKGROUND_KEYS.day];
    const night = configs[COLLECTION_HOME_BACKGROUND_KEYS.night];

    return {
      day: day?.status === 1 ? parseHttpsUrl(day.value) : undefined,
      night: night?.status === 1 ? parseHttpsUrl(night.value) : undefined,
    };
  },
  // v2：首次数据回填绕过了配置 API，需要避开进程中已缓存的空结果。
  ['collections-home-visual-v2'],
  {
    revalidate: 3600,
    tags: ['collections-home-visual'],
  },
);

/** 读取合集首页公开可用的日夜背景 CDN 地址。 */
export async function getCollectionHomeVisualConfig(): Promise<CollectionHomeVisualConfig> {
  return getCachedCollectionHomeVisualConfig();
}
