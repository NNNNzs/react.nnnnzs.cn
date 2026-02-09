/**
 * Google Analytics 4 配置读取工具
 * 从数据库读取配置，支持缓存，避免频繁查询
 * 参考 vector-db-config.ts 的实现模式
 */

import { configByKeys } from '@/services/config';

/**
 * GA4 配置接口
 */
export interface AnalyticsConfig {
  measurementId: string;
  apiSecret: string;
}

/**
 * 内存缓存
 */
const configCache = new Map<string, { value: string | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

/**
 * 清除缓存
 */
export function clearAnalyticsConfigCache(): void {
  configCache.clear();
}

/**
 * 获取单个配置值（带缓存）
 * @param key 配置键
 * @param defaultValue 默认值
 * @returns 配置值
 */
async function getConfigValue(key: string, defaultValue?: string): Promise<string> {
  // 检查缓存
  const cached = configCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value ?? defaultValue ?? '';
  }

  // 从数据库读取
  try {
    const configs = await configByKeys([key]);
    const value = configs[key]?.value ?? null;

    // 更新缓存
    configCache.set(key, {
      value,
      timestamp: Date.now(),
    });

    return value ?? defaultValue ?? '';
  } catch (error) {
    console.error(`获取 GA4 配置失败: ${key}`, error);
    return defaultValue ?? '';
  }
}

/**
 * 获取 GA4 配置
 * @returns GA4 配置对象
 */
export async function getAnalyticsConfig(): Promise<AnalyticsConfig> {
  const measurementId = await getConfigValue('ga4.measurement_id');
  const apiSecret = await getConfigValue('ga4.api_secret');

  return {
    measurementId,
    apiSecret,
  };
}

/**
 * 获取点赞 IP 限制时间（小时）
 * @returns 限制时间（小时），默认 24
 */
export async function getLikeIpLimitHours(): Promise<number> {
  const value = await getConfigValue('like.ip_limit_hours', '24');
  const hours = parseInt(value, 10);
  return isNaN(hours) ? 24 : hours;
}
