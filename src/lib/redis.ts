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
 * 创建 Mock Redis 客户端（用于构建环境）
 */
function createMockRedisClient(): Redis {
  console.log('🚧 构建环境，使用 Mock Redis Client');
  return {
    set: async () => 'OK',
    get: async () => null,
    del: async () => 1,
    exists: async () => 0,
    expire: async () => 1,
    ttl: async () => -1,
    keys: async () => [],
    quit: async () => 'OK',
    on: () => {},
  } as unknown as Redis;
}

/**
 * 获取 Redis 客户端
 */
export function getRedisClient(): Redis {
  // 在构建环境中返回 Mock 客户端
  if (process.env.IS_BUILD === 'true') {
    if (!redisClient) {
      redisClient = createMockRedisClient();
    }
    return redisClient;
  }

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
  private client: Redis;

  constructor() {
    this.client = getRedisClient();
  }

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
    if (process.env.IS_BUILD === 'true') {
      return 'OK';
    }
    if (mode && typeof duration === 'number') {
      if (mode === 'EX') {
        return this.client.set(key, value, 'EX', duration);
      }
      return this.client.set(key, value, 'PX', duration);
    }
    return this.client.set(key, value);
  }

  /**
   * 获取值
   */
  async get(key: string): Promise<string | null> {
    if (process.env.IS_BUILD === 'true') {
      return null;
    }
    return this.client.get(key);
  }

  /**
   * 删除键
   */
  async del(key: string): Promise<number> {
    if (process.env.IS_BUILD === 'true') {
      return 1;
    }
    return this.client.del(key);
  }

  /**
   * 检查键是否存在
   */
  async exists(key: string): Promise<number> {
    if (process.env.IS_BUILD === 'true') {
      return 0;
    }
    return this.client.exists(key);
  }

  /**
   * 设置过期时间
   */
  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  /**
   * 获取剩余过期时间
   */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /**
   * 获取所有匹配的键
   */
  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }
}

/**
 * 导出默认实例
 */
const redisService = new RedisService();
export default redisService;

