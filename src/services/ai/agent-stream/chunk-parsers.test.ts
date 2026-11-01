import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractObservationText } from './chunk-parsers';

function toolOutput(content: unknown) {
  return { output: { lc_kwargs: { content: JSON.stringify(content) } } };
}

test('summarizes public profile results as published persona resources', () => {
  const result = extractObservationText(toolOutput({
    success: true,
    results: [{ uri: 'viking://resources/persona/profile/current.json', content: '{}' }],
  }), 'search_public_profile');

  assert.equal(result, '读取到 1 份已发布人物资料');
});

test('keeps profile retrieval failures distinct from article search results', () => {
  const result = extractObservationText(toolOutput({
    success: false,
    error: 'OpenViking 身份认证失败，请检查博客专用只读 API 密钥是否有效。',
  }), 'search_public_profile');

  assert.equal(
    result,
    '公开资料读取失败：OpenViking 身份认证失败，请检查博客专用只读 API 密钥是否有效。',
  );
});

test('continues to summarize article results with titles', () => {
  const result = extractObservationText(toolOutput({
    results: [{ title: 'A real blog post' }],
  }), 'search_articles');

  assert.equal(result, '找到 1 篇相关文章：\n1. A real blog post');
});
