import redisService from '@/lib/redis';

const DEFAULT_LOCK_SECONDS = 10;
const DEFAULT_WAIT_MS = 1000;
const RETRY_INTERVAL_MS = 100;

interface JsonCacheOptions<T> {
  key: string;
  staleKey?: string;
  load: () => Promise<T>;
  lockSeconds?: number;
  waitMs?: number;
  ttlSeconds?: number;
  client?: JsonCacheClient;
}

export interface JsonCacheClient {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<string | null>;
  setex: (key: string, seconds: number, value: string) => Promise<string | null>;
  setIfAbsent: (key: string, value: string, seconds: number) => Promise<boolean>;
  compareAndDelete: (key: string, expectedValue: string) => Promise<boolean>;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function sleep(delayMs: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

export async function getOrRefreshJsonCache<T>({
  key,
  staleKey = `${key}:stale`,
  load,
  lockSeconds = DEFAULT_LOCK_SECONDS,
  waitMs = DEFAULT_WAIT_MS,
  ttlSeconds,
  client = redisService,
}: JsonCacheOptions<T>): Promise<T | null> {
  const cached = parseJson<T>(await client.get(key));
  if (cached !== null) return cached;

  const stale = parseJson<T>(await client.get(staleKey));
  const lockKey = `${key}:refresh-lock`;
  const lockToken = crypto.randomUUID();
  const acquired = await client.setIfAbsent(lockKey, lockToken, lockSeconds);

  if (!acquired) {
    const attempts = Math.max(1, Math.ceil(waitMs / RETRY_INTERVAL_MS));
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await sleep(RETRY_INTERVAL_MS);
      const refreshed = parseJson<T>(await client.get(key));
      if (refreshed !== null) return refreshed;
    }
    return stale;
  }

  try {
    const loaded = await load();
    const serialized = JSON.stringify(loaded);
    await Promise.all([
      ttlSeconds
        ? client.setex(key, ttlSeconds, serialized)
        : client.set(key, serialized),
      client.set(staleKey, serialized),
    ]);
    return loaded;
  } catch (error) {
    if (stale !== null) return stale;
    throw error;
  } finally {
    try {
      await client.compareAndDelete(lockKey, lockToken);
    } catch (error) {
      console.error('释放 Redis 缓存刷新锁失败:', error);
    }
  }
}
