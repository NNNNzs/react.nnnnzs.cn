import assert from 'node:assert/strict';
import test from 'node:test';
import type { SerializedPost } from '@/dto/post.dto';
import {
  collectCollectionCacheImpact,
  collectDeployCacheImpact,
  collectPostCacheImpact,
  normalizeCacheImpactPlan,
  publicRoute,
  type CacheImpactPlan,
} from '@/lib/cache-impact';
import { executeCacheImpactBackground } from '@/services/cache-refresh';
import { classifyTencentCdnTargets } from '@/services/tencent-cdn';

function post(overrides: Partial<SerializedPost> = {}): SerializedPost {
  return {
    id: 1,
    title: 'old-title',
    content: 'old content',
    description: 'description',
    path: '/2026/07/31/old-title',
    date: '2026-07-31T00:00:00.000Z',
    updated: '2026-07-31T08:00:00.000Z',
    tags: ['old/tag', 'shared'],
    category: 'old category',
    cover: null,
    layout: 'post',
    hide: '0',
    is_delete: 0,
    likes: 0,
    visitors: 0,
    created_by: 1,
    ...overrides,
  } as SerializedPost;
}

test('dynamic public routes encode names and normalize slashes', () => {
  assert.equal(publicRoute.post('https://www.nnnnzs.cn/a/b/'), '/a/b');
  assert.equal(publicRoute.tag('前端/Next.js'), '/tags/%E5%89%8D%E7%AB%AF%2FNext.js');
  assert.equal(publicRoute.category('Web 开发'), '/categories/Web%20%E5%BC%80%E5%8F%91');
  assert.equal(publicRoute.collection('reading list'), '/collections/reading%20list');
});

test('content update refreshes detail, RSS and current collections only', () => {
  const before = post();
  const after = post({
    content: 'new content',
    updated: '2026-07-31T08:01:00.000Z',
  });
  const plan = collectPostCacheImpact({
    kind: 'update',
    before,
    after,
    beforeCollections: [{ slug: 'series-a' }],
    afterCollections: [{ slug: 'series-a' }],
    changedFields: ['content'],
  });

  assert.deepEqual(
    new Set(plan.cdnPagePaths),
    new Set(['/2026/07/31/old-title', '/rss.xml', '/collections/series-a']),
  );
  assert.equal(plan.cdnPagePaths.includes('/'), false);
  assert.equal(plan.cdnPagePaths.includes('/tags/old%2Ftag'), false);
  assert.equal(plan.cdnPagePaths.includes('/categories/old%20category'), false);
});

test('identity and taxonomy updates include both old and new relationships', () => {
  const before = post();
  const after = post({
    title: 'new-title',
    path: '/2026/08/01/new-title',
    date: '2026-08-01T00:00:00.000Z',
    tags: ['new tag', 'shared'],
    category: 'new category',
    updated: '2026-07-31T08:02:00.000Z',
  });
  const plan = collectPostCacheImpact({
    kind: 'update',
    before,
    after,
    beforeCollections: [{ slug: 'old-series' }],
    afterCollections: [{ slug: 'new-series' }],
    changedFields: ['title', 'path', 'date', 'tags', 'category', 'collections'],
  });

  for (const path of [
    '/2026/07/31/old-title',
    '/2026/08/01/new-title',
    '/',
    '/archives',
    '/rss.xml',
    '/sitemap.xml',
    '/tags/old%2Ftag',
    '/tags/new%20tag',
    '/categories/old%20category',
    '/categories/new%20category',
    '/collections/old-series',
    '/collections/new-series',
  ]) {
    assert.ok(plan.cdnPagePaths.includes(path), `missing ${path}`);
  }
  assert.equal(
    plan.warmupTargets.find((target) => target.path === before.path)?.expectedVisibility,
    'absent',
  );
  assert.equal(
    plan.warmupTargets.find((target) => target.path === before.path)?.expectedUpdatedAt,
    after.updated,
  );
});

test('hide and delete retain the old detail path and old relationships', () => {
  const before = post();
  const after = post({ hide: '1', updated: '2026-07-31T08:03:00.000Z' });
  const plan = collectPostCacheImpact({
    kind: 'update',
    before,
    after,
    beforeCollections: [{ slug: 'old-series' }],
    afterCollections: [{ slug: 'old-series' }],
    changedFields: ['hide'],
  });

  assert.ok(plan.cdnPagePaths.includes(before.path));
  assert.ok(plan.cdnPagePaths.includes('/collections/old-series'));
  assert.ok(plan.cdnPagePaths.includes('/tags/old%2Ftag'));
  assert.equal(
    plan.warmupTargets.find((target) => target.path === before.path)?.expectedVisibility,
    'absent',
  );
});

test('likes, visitors and internal RAG updates have no public cache impact', () => {
  for (const field of ['likes', 'visitors', 'rag_status']) {
    const plan = collectPostCacheImpact({
      kind: 'update',
      before: post(),
      after: post({ likes: 1 }),
      changedFields: [field],
    });
    assert.deepEqual(plan.cdnPagePaths, []);
    assert.deepEqual(plan.nextTags, []);
  }
});

test('collection membership and sorting share the complete public range', () => {
  const visible = post();
  const hidden = post({ id: 2, path: '/hidden', hide: '1' });
  for (const membershipChanged of [true, false]) {
    const plan = collectCollectionCacheImpact({
      collectionSlug: 'series',
      posts: [visible, hidden],
      membershipChanged,
    });
    assert.deepEqual(
      new Set(plan.cdnPagePaths),
      new Set(['/collections/series', '/collections', '/', visible.path]),
    );
  }
});

test('deploy mapping handles route families, static assets and full-site fallback', () => {
  const catalog = {
    postPaths: ['/2026/07/31/post'],
    tagNames: ['Next.js'],
    categoryNames: ['Web'],
    collectionSlugs: ['series'],
  };
  const precise = collectDeployCacheImpact([
    'src/app/archives/page.tsx',
    'public/logo.svg',
    'src/app/api/admin/route.ts',
    'docs/cache.md',
  ], catalog);
  assert.deepEqual(precise.cdnPagePaths, ['/archives']);
  assert.deepEqual(precise.cdnAssetUrls, ['/logo.svg']);
  assert.equal(precise.cdnFullSite, false);

  const family = collectDeployCacheImpact(['src/app/[year]/[month]/[date]/[title]/page.tsx'], catalog);
  assert.deepEqual(family.cdnPagePaths, catalog.postPaths);

  const fallback = collectDeployCacheImpact(['src/components/SharedPublicShell.tsx'], catalog);
  assert.equal(fallback.cdnFullSite, true);
  assert.ok(fallback.cdnPagePaths.includes('/'));
});

test('plan normalization deduplicates and canonicalizes all path targets', () => {
  const plan = normalizeCacheImpactPlan({
    source: 'post',
    nextTags: ['post', 'post'],
    nextPaths: ['/a/', '/a'],
    warmupTargets: [{ path: '/a/' }, { path: '/a', expectedVisibility: 'visible' }],
    cdnPagePaths: ['/a/', '/a'],
    cdnAssetUrls: ['/logo.svg', '/logo.svg'],
  });
  assert.deepEqual(plan.nextTags, ['post']);
  assert.deepEqual(plan.nextPaths, ['/a']);
  assert.deepEqual(plan.cdnPagePaths, ['/a']);
  assert.deepEqual(plan.cdnAssetUrls, ['/logo.svg']);
  assert.deepEqual(plan.warmupTargets, [{ path: '/a', expectedVisibility: 'visible' }]);
});

test('CDN classification uses exact URLs for root, XML and assets', () => {
  const previousSiteUrl = process.env.CDN_SITE_URL;
  process.env.CDN_SITE_URL = 'https://www.example.cn';
  try {
    assert.deepEqual(classifyTencentCdnTargets({
      cdnPagePaths: ['/', '/rss.xml', '/article'],
      cdnAssetUrls: ['/logo.svg', 'https://static.example.cn/image.png'],
    }), {
      urlTargets: [
        'https://www.example.cn/logo.svg',
        'https://static.example.cn/image.png',
        'https://www.example.cn/',
        'https://www.example.cn/rss.xml',
      ],
      pathTargets: ['https://www.example.cn/article/'],
    });
  } finally {
    if (previousSiteUrl === undefined) delete process.env.CDN_SITE_URL;
    else process.env.CDN_SITE_URL = previousSiteUrl;
  }
});

test('origin validation purges only paths that regenerated successfully', async () => {
  const plan: CacheImpactPlan = {
    source: 'post',
    nextTags: [],
    nextPaths: [],
    warmupTargets: [
      { path: '/fresh', verifyRenderMarker: true },
      { path: '/stale', verifyRenderMarker: true },
    ],
    cdnPagePaths: ['/fresh', '/stale'],
    cdnAssetUrls: [],
  };
  let purged: CacheImpactPlan | undefined;
  await executeCacheImpactBackground(plan, Date.now(), {
    fetchOrigin: (async (url: string | URL | Request) => {
      const path = new URL(String(url)).pathname;
      const renderedAt = path === '/fresh'
        ? '2099-01-01 00:00:00'
        : '2020-01-01 00:00:00';
      return new Response(
        `<html><head><meta name="next-rendered-at" content="${renderedAt}"></head></html>`,
        { status: 200 },
      );
    }) as typeof fetch,
    purge: async (input) => {
      purged = {
        source: 'post',
        nextTags: [],
        nextPaths: [],
        warmupTargets: [],
        ...input,
      };
    },
  });
  assert.deepEqual(purged?.cdnPagePaths, ['/fresh']);
});
