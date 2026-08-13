import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTENT_DRAFT_PREVIEW_TTL_SECONDS,
  createContentDraftPreviewUrl,
  getSafePublicImageUrl,
  getSafePublicMarkdownUrl,
  parseContentDraftPreviewMode,
  verifyContentDraftPreviewSignature,
} from './content-draft-preview';

const now = Date.parse('2026-08-13T00:00:00.000Z');

test('signed preview URL is valid for seven days and mode does not affect its signature', () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'preview-test-secret';
  try {
    const url = new URL(createContentDraftPreviewUrl(123, now), 'https://www.example.com');
    const expiresAt = Number(url.searchParams.get('expiresAt'));
    assert.equal(expiresAt, Math.floor(now / 1000) + CONTENT_DRAFT_PREVIEW_TTL_SECONDS);
    assert.equal(verifyContentDraftPreviewSignature(123, expiresAt, url.searchParams.get('signature'), now), true);
    url.searchParams.set('mode', 'zhihu');
    assert.equal(verifyContentDraftPreviewSignature(123, expiresAt, url.searchParams.get('signature'), now), true);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test('preview signature rejects changed draft ID, expiry, signature, expired URL, and missing secret', () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'preview-test-secret';
  try {
    const url = new URL(createContentDraftPreviewUrl(123, now), 'https://www.example.com');
    const expiresAt = Number(url.searchParams.get('expiresAt'));
    const signature = url.searchParams.get('signature');
    assert.equal(verifyContentDraftPreviewSignature(124, expiresAt, signature, now), false);
    assert.equal(verifyContentDraftPreviewSignature(123, expiresAt + 1, signature, now), false);
    assert.equal(verifyContentDraftPreviewSignature(123, expiresAt, `${signature}x`, now), false);
    assert.equal(verifyContentDraftPreviewSignature(123, expiresAt, signature, expiresAt * 1000), false);
    delete process.env.JWT_SECRET;
    assert.equal(verifyContentDraftPreviewSignature(123, expiresAt, signature, now), false);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test('preview mode and public URLs accept only supported and safe values', () => {
  assert.equal(parseContentDraftPreviewMode('xhs'), 'xhs');
  assert.equal(parseContentDraftPreviewMode('zhihu'), 'zhihu');
  assert.equal(parseContentDraftPreviewMode('toutiao'), 'toutiao');
  assert.equal(parseContentDraftPreviewMode('admin'), null);
  assert.equal(getSafePublicImageUrl('javascript:alert(1)'), null);
  assert.equal(getSafePublicMarkdownUrl('https://example.com/read', 'link'), 'https://example.com/read');
  assert.equal(getSafePublicMarkdownUrl('/private-path', 'link'), '');
});
