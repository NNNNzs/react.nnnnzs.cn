import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyCollectionVisualConfig,
  createCollectionVisualConfigWithLegacyFallback,
  getCollectionVisualCompleteness,
  normalizeCollectionVisualConfigForSubmit,
  parseCollectionVisualConfig,
  resolveCollectionVisual,
} from '@/lib/collection-visual';

test('invalid collection visual JSON falls back to null', () => {
  assert.equal(parseCollectionVisualConfig({ version: 2 }), null);
  assert.deepEqual(parseCollectionVisualConfig(createEmptyCollectionVisualConfig()), {
    version: 1,
    presentation: { day: {}, night: {} },
  });
});

test('form submission always restores literal version 1', () => {
  const normalized = normalizeCollectionVisualConfigForSubmit({
    presentation: {
      day: { coverImageUrl: 'https://static.nnnnzs.cn/day.png' },
      night: {},
    },
    readingPath: ['开始', '深入'],
  });

  assert.equal(normalized.version, 1);
  assert.deepEqual(normalized.readingPath, ['开始', '深入']);
  assert.equal(
    normalized.presentation.day.coverImageUrl,
    'https://static.nnnnzs.cn/day.png',
  );
  assert.notEqual(parseCollectionVisualConfig(normalized), null);
});

test('valid config falls through the other theme but never rehydrates legacy fields', () => {
  const visual = resolveCollectionVisual({
    cover: 'https://static.nnnnzs.cn/legacy-cover.png',
    background: 'https://static.nnnnzs.cn/legacy-background.png',
    color: '#334455',
    extends_json: {
      version: 1,
      presentation: {
        day: {},
        night: { coverImageUrl: 'https://static.nnnnzs.cn/night-cover.png' },
      },
    },
  }, 'day');

  assert.equal(visual.coverImageUrl, 'https://static.nnnnzs.cn/night-cover.png');
  assert.equal(visual.backgroundImageUrl, undefined);
  assert.equal(visual.accentColor, '#7a8c98');
});

test('legacy fields are mapped into day visual slots', () => {
  const config = createCollectionVisualConfigWithLegacyFallback({
    cover: 'https://static.nnnnzs.cn/legacy-cover.png',
    background: 'https://static.nnnnzs.cn/archive.mp4?version=1',
    color: '#334455',
  });

  assert.equal(config.presentation.day.coverImageUrl, 'https://static.nnnnzs.cn/legacy-cover.png');
  assert.equal(config.presentation.day.coverVideoUrl, 'https://static.nnnnzs.cn/archive.mp4?version=1');
  assert.equal(config.presentation.day.backgroundImageUrl, undefined);
  assert.equal(config.presentation.day.accentColor, '#334455');
});

test('legacy video is a day cover video and never an image background', () => {
  const visual = resolveCollectionVisual({
    background: 'https://static.nnnnzs.cn/archive.mp4?version=1',
  }, 'day');

  assert.equal(visual.backgroundImageUrl, undefined);
  assert.equal(visual.coverVideoUrl, 'https://static.nnnnzs.cn/archive.mp4?version=1');
});

test('valid config preserves an explicitly cleared day cover video', () => {
  const collection = {
    background: 'https://static.nnnnzs.cn/legacy-video.mp4',
    extends_json: {
      version: 1,
      presentation: {
        day: {},
        night: { coverVideoUrl: 'https://static.nnnnzs.cn/night-video.mp4' },
      },
    },
  };

  const formConfig = createCollectionVisualConfigWithLegacyFallback(collection);
  const dayVisual = resolveCollectionVisual(collection, 'day');

  assert.equal(formConfig.presentation.day.coverVideoUrl, undefined);
  assert.equal(dayVisual.coverVideoUrl, undefined);
});

test('visual completeness counts only theme-specific assets', () => {
  const collection = {
    extends_json: {
      version: 1,
      presentation: {
        day: {
          coverImageUrl: 'https://static.nnnnzs.cn/day-cover.png',
          backgroundImageUrl: 'https://static.nnnnzs.cn/day-background.png',
        },
        night: {},
      },
    },
  };

  assert.deepEqual(getCollectionVisualCompleteness(collection, 'day'), { configured: 2, total: 3 });
  assert.deepEqual(getCollectionVisualCompleteness(collection, 'night'), { configured: 0, total: 3 });
});
