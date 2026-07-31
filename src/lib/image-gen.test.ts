import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/test';

const imageGenService = import('@/services/image-gen');

test('images_generations 无参考图时使用图片生成接口', async () => {
  const { resolveImageGenOperation } = await imageGenService;
  assert.equal(
    resolveImageGenOperation('images_generations', {}),
    'images_generations',
  );
});

test('images_generations 有单张或多张参考图时使用图片编辑接口', async () => {
  const { resolveImageGenOperation } = await imageGenService;
  assert.equal(
    resolveImageGenOperation('images_generations', {
      image: 'https://static.nnnnzs.cn/reference.png',
    }),
    'images_edits',
  );
  assert.equal(
    resolveImageGenOperation('images_generations', {
      images: [
        'https://static.nnnnzs.cn/reference-1.png',
        'https://static.nnnnzs.cn/reference-2.png',
      ],
    }),
    'images_edits',
  );
});

test('参考图输入会去空白、合并兼容字段并去重', async () => {
  const { normalizeImageInputs } = await imageGenService;
  assert.deepEqual(
    normalizeImageInputs({
      image: 'https://static.nnnnzs.cn/a.png\nhttps://static.nnnnzs.cn/b.png',
      images: [
        ' https://static.nnnnzs.cn/b.png ',
        'https://static.nnnnzs.cn/c.png',
      ],
    }),
    [
      'https://static.nnnnzs.cn/b.png',
      'https://static.nnnnzs.cn/c.png',
      'https://static.nnnnzs.cn/a.png',
    ],
  );
});

test('统一图片生成参数要求提示词且最多接受十张参考图', async () => {
  const { validateImageGenOptions } = await imageGenService;
  assert.throws(
    () => validateImageGenOptions({ prompt: ' ' }),
    /提示词不能为空/,
  );

  assert.doesNotThrow(() => validateImageGenOptions({
    prompt: '根据参考图生成封面',
    images: Array.from({ length: 10 }, (_, index) => `https://static.nnnnzs.cn/${index}.png`),
  }));

  assert.throws(
    () => validateImageGenOptions({
      prompt: '根据参考图生成封面',
      images: Array.from({ length: 11 }, (_, index) => `https://static.nnnnzs.cn/${index}.png`),
    }),
    /最多支持 10 张参考图片/,
  );
});
