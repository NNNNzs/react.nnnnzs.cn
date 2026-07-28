/**
 * Redis 客户端配置
 * 参考 api.nnnnzs.cn/src/utils/redis.service.ts
 */

import Redis from 'ioredis';

/**
 * Redis 客户端实例（单例）
 */
let redisClient: Redis | null = null;

/**
 * 获取 Redis 客户端
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB) || 0,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis 连接成功');
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis 连接错误:', err);
    });
  }

  return redisClient;
}

/**
 * 关闭 Redis 连接
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('✅ Redis 连接已关闭');
  }
}

/**
 * Redis 操作封装
 */
export class RedisService {
  /**
   * 设置键值
   */
  async set(key: string, value: string): Promise<string | null>;
  async set(key: string, value: string, mode: 'EX' | 'PX', duration: number): Promise<string | null>;
  async set(
    key: string,
    value: string,
    mode?: 'EX' | 'PX',
    duration?: number
  ): Promise<string | null> {
    if (mode && typeof duration === 'number') {
      if (mode === 'EX') {
        return getRedisClient().set(key, value, 'EX', duration);
      }
      return getRedisClient().set(key, value, 'PX', duration);
    }
    return getRedisClient().set(key, value);
  }

  /**
   * 获取值
   */
  async get(key: string): Promise<string | null> {
    return getRedisClient().get(key);
  }

  /**
   * 删除键
   */
  async del(key: string): Promise<number> {
    return getRedisClient().del(key);
  }

  /**
   * 检查键是否存在
   */
  async exists(key: string): Promise<number> {
    return getRedisClient().exists(key);
  }

  /**
   * 设置键值并指定过期时间（秒）
   */
  async setex(key: string, seconds: number, value: string): Promise<string | null> {
    return getRedisClient().setex(key, seconds, value);
  }

  /** 仅在键不存在时写入，并设置秒级过期时间。 */
  async setIfAbsent(key: string, value: string, seconds: number): Promise<boolean> {
    return (await getRedisClient().set(key, value, 'EX', seconds, 'NX')) === 'OK';
  }

  /** 仅当值仍属于当前持有者时删除锁。 */
  async compareAndDelete(key: string, expectedValue: string): Promise<boolean> {
    const result = await getRedisClient().eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      key,
      expectedValue,
    );
    return Number(result) === 1;
  }

  async eval(script: string, keys: string[], args: string[]): Promise<unknown> {
    return getRedisClient().eval(script, keys.length, ...keys, ...args);
  }

  /**
   * 设置过期时间
   */
  async expire(key: string, seconds: number): Promise<number> {
    return getRedisClient().expire(key, seconds);
  }

  /**
   * 获取剩余过期时间
   */
  async ttl(key: string): Promise<number> {
    return getRedisClient().ttl(key);
  }

  /**
   * 获取所有匹配的键
   */
  async keys(pattern: string): Promise<string[]> {
    return getRedisClient().keys(pattern);
  }
}

/**
 * 导出默认实例
 */
const redisService = new RedisService();
export default redisService;
