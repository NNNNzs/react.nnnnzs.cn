import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hashPreviewShareToken,
  getSafePublicImageUrl,
  getSafePublicMarkdownUrl,
  isPreviewShareActive,
  parseContentDraftPreviewMode,
  summarizeDraftPreview,
  toPublicDraftPreviewDto,
} from './content-draft-preview';

test('preview mode only accepts supported modes', () => {
  assert.equal(parseContentDraftPreviewMode('xhs'), 'xhs');
  assert.equal(parseContentDraftPreviewMode('zhihu'), 'zhihu');
  assert.equal(parseContentDraftPreviewMode('toutiao'), 'toutiao');
  assert.equal(parseContentDraftPreviewMode('admin'), null);
});

test('share token hashes deterministically without retaining its input', () => {
  assert.equal(hashPreviewShareToken('opaque-token'), hashPreviewShareToken('opaque-token'));
  assert.notEqual(hashPreviewShareToken('opaque-token'), 'opaque-token');
});

test('expired and revoked shares are never active', () => {
  const now = new Date('2026-08-13T00:00:00.000Z');
  assert.equal(isPreviewShareActive({ expires_at: new Date('2026-08-12T00:00:00.000Z'), revoked_at: null }, now), false);
  assert.equal(isPreviewShareActive({ expires_at: null, revoked_at: now }, now), false);
  assert.equal(isPreviewShareActive({ expires_at: new Date('2026-08-14T00:00:00.000Z'), revoked_at: null }, now), true);
});

test('public DTO is whitelisted, summarizes hook, and orders usable associated images', () => {
  const dto = toPublicDraftPreviewDto({
    title: '公开标题', hook: '  Hook 摘要  ', body: '# 正文', tags_json: [' 技术 ', 2, ''], updated_at: new Date('2026-08-13T00:00:00.000Z'),
    assets: [
      { sort_order: 2, created_at: new Date('2026-08-13T00:01:00.000Z'), asset: { type: 'image', title: null, cdn_url: ' https://img/2 ' } },
      { sort_order: 1, created_at: new Date('2026-08-13T00:02:00.000Z'), asset: { type: 'image', title: '封面', cdn_url: 'https://img/1' } },
      { sort_order: 0, created_at: new Date(), asset: { type: 'image', title: '不可用', cdn_url: null } },
    ],
  });
  assert.deepEqual(Object.keys(dto).sort(), ['author', 'body', 'hook', 'images', 'summary', 'tags', 'title', 'updatedAt'].sort());
  assert.equal(dto.summary, 'Hook 摘要');
  assert.deepEqual(dto.tags, ['技术']);
  assert.deepEqual(dto.images.map((image) => image.url), ['https://img/1', 'https://img/2']);
  assert.equal(summarizeDraftPreview(null, '## 正文  内容'), '正文 内容');
});

test('public DTO excludes unsafe and relative asset URLs', () => {
  const dto = toPublicDraftPreviewDto({
    title: '公开标题', hook: null, body: null, tags_json: null, updated_at: new Date(),
    assets: [
      { sort_order: 1, created_at: new Date(), asset: { type: 'image', title: null, cdn_url: 'javascript:alert(1)' } },
      { sort_order: 2, created_at: new Date(), asset: { type: 'image', title: null, cdn_url: '/private-image' } },
      { sort_order: 3, created_at: new Date(), asset: { type: 'image', title: null, cdn_url: 'https://cdn.example/image.png' } },
    ],
  });
  assert.equal(getSafePublicImageUrl('data:image/png;base64,abc'), null);
  assert.deepEqual(dto.images.map((image) => image.url), ['https://cdn.example/image.png']);
});

test('public Markdown URLs only allow absolute HTTP(S), plus mailto links', () => {
  assert.equal(getSafePublicMarkdownUrl('https://example.com/read', 'link'), 'https://example.com/read');
  assert.equal(getSafePublicMarkdownUrl('mailto:hello@example.com', 'link'), 'mailto:hello@example.com');
  assert.equal(getSafePublicMarkdownUrl('mailto:hello@example.com', 'image'), '');
  assert.equal(getSafePublicMarkdownUrl('/private-path', 'link'), '');
  assert.equal(getSafePublicMarkdownUrl('javascript:alert(1)', 'link'), '');
  assert.equal(getSafePublicMarkdownUrl('data:text/html,unsafe', 'image'), '');
});
