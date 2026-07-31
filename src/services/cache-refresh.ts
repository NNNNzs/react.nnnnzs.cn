import { revalidatePath, revalidateTag } from 'next/cache';
import {
  normalizeCacheImpactPlan,
  type CacheImpactPlan,
  type WarmupTarget,
} from '@/lib/cache-impact';
import { purgeTencentCdn } from '@/services/tencent-cdn';

let backgroundRefreshChain: Promise<void> = Promise.resolve();

const RENDERED_META_PATTERN =
  /<meta\b[^>]*\bname=["']next-rendered-at["'][^>]*>/i;
const META_CONTENT_PATTERN = /\bcontent=["']([^"']+)["']/i;
const POST_ID_PATTERN = /data-post-id=["'](\d+)["']/i;
const POST_UPDATED_PATTERN = /data-post-updated-at=["']([^"']*)["']/i;

function originUrl(path: string): string {
  const origin =
    process.env.CACHE_ORIGIN_URL ||
    `http://127.0.0.1:${process.env.PORT || '3000'}`;
  return new URL(path, origin.endsWith('/') ? origin : `${origin}/`).toString();
}

function parseShanghaiTimestamp(value: string): number {
  return Date.parse(`${value.replace(' ', 'T')}+08:00`);
}

async function warmupTarget(
  target: WarmupTarget,
  scheduledAt: number,
  fetchOrigin: typeof fetch,
): Promise<boolean> {
  try {
    const response = await fetchOrigin(originUrl(target.path), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'X-Cache-Warmup': '1',
      },
    });

    if (target.expectedVisibility === 'absent') {
      if (response.status === 404) return true;
      // 兼容旧地址仍映射到同一篇文章的场景；只有能验证为新版本才允许刷新旧 URL。
      if (!target.expectedUpdatedAt) return false;
    }
    if (!response.ok) {
      console.warn('[缓存预热] 源站响应异常，跳过 CDN 刷新', {
        path: target.path,
        status: response.status,
      });
      return false;
    }

    if (target.verifyRenderMarker === false || target.path.endsWith('.xml')) {
      return true;
    }

    const html = await response.text();
    const renderedMeta = html.match(RENDERED_META_PATTERN)?.[0];
    const renderedAt = renderedMeta?.match(META_CONTENT_PATTERN)?.[1];
    if (!renderedAt || parseShanghaiTimestamp(renderedAt) < scheduledAt - 2_000) {
      console.warn('[缓存预热] 页面仍为旧渲染结果，跳过 CDN 刷新', {
        path: target.path,
        renderedAt,
      });
      return false;
    }

    if (target.expectedPostId !== undefined) {
      const actualPostId = Number(html.match(POST_ID_PATTERN)?.[1]);
      if (actualPostId !== target.expectedPostId) {
        console.warn('[缓存预热] 文章 ID 不符合预期，跳过 CDN 刷新', {
          path: target.path,
          expected: target.expectedPostId,
          actual: actualPostId,
        });
        return false;
      }
    }

    if (target.expectedUpdatedAt) {
      const actualUpdatedAt = html.match(POST_UPDATED_PATTERN)?.[1];
      if (actualUpdatedAt !== target.expectedUpdatedAt) {
        console.warn('[缓存预热] 文章版本不符合预期，跳过 CDN 刷新', {
          path: target.path,
          expected: target.expectedUpdatedAt,
          actual: actualUpdatedAt,
        });
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('[缓存预热] 请求失败，跳过 CDN 刷新', {
      path: target.path,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

function invalidateNextCache(plan: CacheImpactPlan): void {
  for (const tag of plan.nextTags) {
    revalidateTag(tag, { expire: 0 });
  }
  for (const path of plan.nextPaths) {
    revalidatePath(path);
  }
}

export interface CacheRefreshDependencies {
  fetchOrigin?: typeof fetch;
  purge?: typeof purgeTencentCdn;
}

export async function executeCacheImpactBackground(
  input: CacheImpactPlan,
  scheduledAt = Date.now(),
  dependencies: CacheRefreshDependencies = {},
): Promise<void> {
  const plan = normalizeCacheImpactPlan(input);
  const fetchOrigin = dependencies.fetchOrigin || fetch;
  const purge = dependencies.purge || purgeTencentCdn;
  const successfulPaths = new Set<string>();
  for (const target of plan.warmupTargets) {
    if (await warmupTarget(target, scheduledAt, fetchOrigin)) {
      successfulPaths.add(target.path);
    }
  }

  const cdnPagePaths = plan.cdnFullSite
    ? plan.cdnPagePaths
    : plan.cdnPagePaths.filter((path) => successfulPaths.has(path));

  try {
    await purge({
      cdnPagePaths,
      cdnAssetUrls: plan.cdnAssetUrls,
      cdnFullSite: plan.cdnFullSite && successfulPaths.has('/'),
    });
  } catch (error) {
    console.error('[CDN刷新] 提交失败，不影响业务结果', {
      source: plan.source,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function scheduleCacheImpact(input: CacheImpactPlan): void {
  const plan = normalizeCacheImpactPlan(input);
  if (
    !plan.nextTags.length &&
    !plan.nextPaths.length &&
    !plan.cdnPagePaths.length &&
    !plan.cdnAssetUrls.length
  ) {
    return;
  }

  const scheduledAt = Date.now();
  try {
    invalidateNextCache(plan);
  } catch (error) {
    console.error('[Next缓存] 失效标记失败，不影响业务结果', {
      source: plan.source,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  backgroundRefreshChain = backgroundRefreshChain
    .then(() => executeCacheImpactBackground(plan, scheduledAt))
    .catch((error) => {
      console.error('[缓存刷新] 后台链路异常，不影响业务结果', {
        source: plan.source,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

export async function executeDeployCacheImpact(plan: CacheImpactPlan): Promise<void> {
  await executeCacheImpactBackground(plan);
}
