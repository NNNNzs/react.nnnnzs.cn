import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeModelNames, normalizeProviderModels } from './ai-provider';

test('normalizes legacy provider model lists without losing old request behavior', () => {
  const models = normalizeProviderModels(['bge-m3', 'qwen3.5:4b', 'bge-m3']);

  assert.deepEqual(models, [
    {
      id: 'bge-m3',
      isEmbeddingModel: false,
      sendDimensions: true,
      configured: false,
    },
    {
      id: 'qwen3.5:4b',
      isEmbeddingModel: false,
      sendDimensions: true,
      configured: false,
    },
  ]);
});

test('reads per-model embedding and dimensions settings from the existing JSON value', () => {
  const models = normalizeProviderModels([
    { id: 'BAAI/bge-m3', isEmbeddingModel: true, sendDimensions: false },
    { id: 'qwen3.5:4b', isEmbeddingModel: false, sendDimensions: true },
  ]);

  assert.deepEqual(models[0], {
    id: 'BAAI/bge-m3',
    isEmbeddingModel: true,
    sendDimensions: false,
    configured: true,
  });
  assert.deepEqual(normalizeModelNames(models), ['BAAI/bge-m3', 'qwen3.5:4b']);
});
