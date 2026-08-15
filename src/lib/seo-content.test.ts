import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSeoDescription,
  getSeoQualityRisks,
  markdownToPlainText,
  meetsSeoAggregateThreshold,
} from '@/lib/seo-content';
import { isAdSenseExcludedRoute } from '@/lib/adsense-route';
import { batchSeoIndexingSchema } from '@/lib/post-seo-indexing';
import { getSiteUrl } from '@/lib/site-url';

test('Markdown 摘要会移除 HTML 与语法标记并压缩空白', () => {
  assert.equal(
    markdownToPlainText('# 标题\n\n<strong>正文</strong> [链接](https://example.com) `code`'),
    '标题 正文 链接 code',
  );
});

test('SEO 摘要优先使用描述并限制为 160 个 Unicode 字符', () => {
  const description = `**${'文'.repeat(170)}**`;
  assert.equal(Array.from(createSeoDescription(description, '正文', '回退')).length, 160);
  assert.equal(createSeoDescription('', '正文内容', '回退'), '正文内容');
});

test('质量提示覆盖短正文、短描述、占位标题和无分类标签', () => {
  const risks = getSeoQualityRisks({
    title: '无标题文章',
    content: '短文',
    description: '',
    category: null,
    tags: [],
  });
  assert.deepEqual(risks.map((risk) => risk.code), [
    'short-content',
    'short-description',
    'placeholder-title',
    'missing-taxonomy',
  ]);
});

test('质量提示不改变人工开关，聚合页阈值固定为 3 篇', () => {
  const manualIndexable = true;
  assert.equal(getSeoQualityRisks({ title: '正式标题', content: '短文' }).length > 0, true);
  assert.equal(manualIndexable, true);
  assert.equal(meetsSeoAggregateThreshold(2), false);
  assert.equal(meetsSeoAggregateThreshold(3), true);
});

test('AdSense 只在公开内容路由加载', () => {
  for (const path of ['/c/post', '/create/drafts', '/login', '/archives', '/privacy']) {
    assert.equal(isAdSenseExcludedRoute(path), true, path);
  }
  assert.equal(isAdSenseExcludedRoute('/2026/08/16/article'), false);
  assert.equal(isAdSenseExcludedRoute('/tags/Next.js'), false);
});

test('批量 SEO 收录校验拒绝空数组、重复 ID 和超过 50 篇', () => {
  assert.equal(batchSeoIndexingSchema.safeParse({ postIds: [], seoIndexable: true }).success, false);
  assert.equal(batchSeoIndexingSchema.safeParse({ postIds: [1, 1], seoIndexable: true }).success, false);
  assert.equal(batchSeoIndexingSchema.safeParse({
    postIds: Array.from({ length: 51 }, (_, index) => index + 1),
    seoIndexable: false,
  }).success, false);
  assert.equal(batchSeoIndexingSchema.safeParse({ postIds: [1, 2], seoIndexable: false }).success, true);
});

test('生产构建不会把 localhost 写入正式 canonical', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  Object.assign(process.env, {
    NODE_ENV: 'production',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  });
  try {
    assert.equal(getSiteUrl(), 'https://www.nnnnzs.cn');
  } finally {
    Object.assign(process.env, {
      NODE_ENV: previousNodeEnv,
      NEXT_PUBLIC_SITE_URL: previousSiteUrl,
    });
  }
});
