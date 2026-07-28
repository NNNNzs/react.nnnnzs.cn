import assert from 'node:assert/strict';
import test from 'node:test';
import { canAcquireCrossTabLease } from '@/lib/cross-tab-leader-coordinator';
import { mergeDeployHistories } from '@/lib/deploy-history-cache';
import { applyPollJitter, getPollBackoffDelay } from '@/lib/polling';
import { getOrRefreshJsonCache, type JsonCacheClient } from '@/lib/redis-json-cache';
import { isWebhookAuthorized } from '@/lib/webhook-auth';

test('poll jitter stays inside the configured range', () => {
  assert.equal(applyPollJitter(1000, 0.2, () => 0), 800);
  assert.equal(applyPollJitter(1000, 0.2, () => 0.5), 1000);
  assert.equal(applyPollJitter(1000, 0.2, () => 1), 1200);
});

test('poll backoff grows exponentially and respects the cap', () => {
  assert.equal(getPollBackoffDelay(15_000, 1, 60_000), 15_000);
  assert.equal(getPollBackoffDelay(15_000, 3, 60_000), 60_000);
  assert.equal(getPollBackoffDelay(15_000, 8, 60_000), 60_000);
});

test('expired cross-tab leases can be taken over', () => {
  const lease = { ownerId: 'old-tab', expiresAt: 11_999 };
  assert.equal(canAcquireCrossTabLease(lease, 'new-tab', 11_998), false);
  assert.equal(canAcquireCrossTabLease(lease, 'new-tab', 11_999), true);
  assert.equal(canAcquireCrossTabLease(lease, 'old-tab', 1), true);
});

test('webhook deployment increments are merged with a full GitHub history', () => {
  const githubRecord = {
    status: 'success' as const,
    timestamp: '2026-07-27T12:00:00.000Z',
    commit: 'aaaaaaa',
    version: '#10',
    runId: 10,
  };
  const liveRecord = {
    status: 'deploying' as const,
    timestamp: '2026-07-28T12:00:00.000Z',
    commit: 'bbbbbbb',
    version: 'v2026.07.28',
    runId: '11',
  };
  const staleGithubCopy = { ...liveRecord, status: 'success' as const, runId: 11 };
  const merged = mergeDeployHistories([liveRecord], [staleGithubCopy, githubRecord]);
  assert.deepEqual(merged, [liveRecord, githubRecord]);
});

test('webhook authorization requires an exact configured bearer token', () => {
  assert.equal(isWebhookAuthorized('Bearer secret', 'secret'), true);
  assert.equal(isWebhookAuthorized('Bearer wrong', 'secret'), false);
  assert.equal(isWebhookAuthorized(null, 'secret'), false);
  assert.equal(isWebhookAuthorized('Bearer secret', undefined), false);
});

test('concurrent cache misses invoke the upstream loader only once', async () => {
  const values = new Map<string, string>();
  const locks = new Map<string, string>();
  let setexCount = 0;
  const client: JsonCacheClient = {
    async get(key) { return values.get(key) ?? null; },
    async set(key, value) { values.set(key, value); return 'OK'; },
    async setex(key, _seconds, value) {
      setexCount += 1;
      values.set(key, value);
      return 'OK';
    },
    async setIfAbsent(key, value) {
      if (locks.has(key)) return false;
      locks.set(key, value);
      return true;
    },
    async compareAndDelete(key, expectedValue) {
      if (locks.get(key) !== expectedValue) return false;
      locks.delete(key);
      return true;
    },
  };
  let loadCount = 0;
  const load = async () => {
    loadCount += 1;
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    return [{ id: 1 }];
  };

  const results = await Promise.all(Array.from({ length: 20 }, () => (
    getOrRefreshJsonCache({ key: 'test', client, load, waitMs: 200, ttlSeconds: 60 })
  )));

  assert.equal(loadCount, 1);
  assert.equal(setexCount, 1);
  assert.deepEqual(results, Array.from({ length: 20 }, () => [{ id: 1 }]));
});
