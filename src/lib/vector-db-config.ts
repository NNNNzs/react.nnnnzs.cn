/**
 * 向量数据库配置读取工具
 * 从数据库读取配置，支持缓存，避免频繁查询
 * 支持回退到环境变量以保证兼容性
 */

import { configByKeys } from '@/services/config';

/**
 * 向量数据库配置接口
 */
export interface VectorDBConfig {
  url: string;
  api_key?: string;
  timeout?: number;
}

/**
 * 内存缓存
 */
const configCache = new Map<string, { value: string | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

/**
 * 清除缓存
 */
export function clearVectorDBConfigCache(): void {
  configCache.clear();
}

/**
 * 获取单个配置值（带缓存）
 * 优先从数据库读取，如果不存在则回退到环境变量
 */
async function getConfigValue(
  key: string,
  envKey: string,
  defaultValue?: string
): Promise<string> {
  // 检查缓存
  const cached = configCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value ?? process.env[envKey] ?? defaultValue ?? '';
  }

  // 从数据库读取
  try {
    const configs = await configByKeys([key]);
    const config = configs[key];
    const value = config?.value ?? null;

    // 更新缓存
    configCache.set(key, {
      value,
      timestamp: Date.now(),
    });

    // 如果数据库中没有值，回退到环境变量
    return value ?? process.env[envKey] ?? defaultValue ?? '';
  } catch (error) {
    console.error(`获取向量数据库配置失败: ${key}`, error);
    // 出错时回退到环境变量
    return process.env[envKey] ?? defaultValue ?? '';
  }
}

/**
 * 获取向量数据库配置
 * @returns 向量数据库配置对象
 */
export async function getVectorDBConfig(): Promise<VectorDBConfig> {
  // 从数据库读取配置，如果不存在则回退到环境变量
  const url = await getConfigValue('qdrant.url', 'QDRANT_URL', 'http://localhost:6333');
  const apiKey = await getConfigValue('qdrant.api_key', 'QDRANT_API_KEY');
  const timeoutStr = await getConfigValue('qdrant.timeout', 'QDRANT_TIMEOUT', '30000');
  const timeout = parseInt(timeoutStr, 10);

  // 验证必需配置
  if (!url) {
    throw new Error('向量数据库 URL 配置缺失');
  }

  return {
    url,
    api_key: apiKey || undefined,
    timeout: isNaN(timeout) ? 30000 : timeout,
  };
}
