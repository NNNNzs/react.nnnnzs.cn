/**
 * AI 模型配置读取工具
 * 从数据库读取配置，支持缓存，避免频繁查询
 */

import { configByKeys } from '@/services/config';

/**
 * AI 配置场景类型
 */
export type AIConfigScenario = 'ai_text' | 'description' | 'chat' | 'embedding';

/**
 * AI 配置接口
 */
export interface AIConfig {
  api_key: string;
  model: string;
  base_url: string;
  temperature?: number;
  max_tokens?: number;
  dimensions?: number; // 仅用于 embedding
}

/**
 * 内存缓存（简单实现，生产环境可考虑使用 Redis）
 */
const configCache = new Map<string, { value: string | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

/**
 * 清除缓存
 */
export function clearAIConfigCache(): void {
  configCache.clear();
}

/**
 * 获取单个配置值（带缓存）
 * @param key 配置 key
 * @param defaultValue 默认值（如果配置不存在）
 * @returns 配置值或默认值
 */
export async function getAIConfigValue(
  key: string,
  defaultValue?: string
): Promise<string | null> {
  // 检查缓存
  const cached = configCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value ?? defaultValue ?? null;
  }

  // 从数据库读取
  try {
    const configs = await configByKeys([key]);
    const config = configs[key];
    const value = config?.value ?? defaultValue ?? null;

    // 更新缓存
    configCache.set(key, {
      value,
      timestamp: Date.now(),
    });

    return value;
  } catch (error) {
    console.error(`获取配置失败: ${key}`, error);
    return defaultValue ?? null;
  }
}

/**
 * 批量获取配置值（带缓存）
 * @param keys 配置 key 数组
 * @returns 配置值映射
 */
export async function getAIConfigValues(
  keys: string[]
): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  const uncachedKeys: string[] = [];

  // 先检查缓存
  for (const key of keys) {
    const cached = configCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      result[key] = cached.value;
    } else {
      uncachedKeys.push(key);
    }
  }

  // 批量查询未缓存的配置
  if (uncachedKeys.length > 0) {
    try {
      const configs = await configByKeys(uncachedKeys);
      for (const key of uncachedKeys) {
        const config = configs[key];
        const value = config?.value ?? null;
        result[key] = value;

        // 更新缓存
        configCache.set(key, {
          value,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error('批量获取配置失败:', error);
      // 未缓存的 key 设置为 null
      for (const key of uncachedKeys) {
        if (!(key in result)) {
          result[key] = null;
        }
      }
    }
  }

  return result;
}

/**
 * 获取指定场景的完整 AI 配置
 * @param scenario 配置场景
 * @returns AI 配置对象
 */
export async function getAIConfig(scenario: AIConfigScenario): Promise<AIConfig> {
  const keys = [
    `${scenario}.api_key`,
    `${scenario}.model`,
    `${scenario}.base_url`,
    `${scenario}.temperature`,
    `${scenario}.max_tokens`,
  ];

  // embedding 场景需要 dimensions
  if (scenario === 'embedding') {
    keys.push(`${scenario}.dimensions`);
  }

  const values = await getAIConfigValues(keys);

  // 验证必需配置
  const apiKey = values[`${scenario}.api_key`];
  const model = values[`${scenario}.model`];
  const baseUrl = values[`${scenario}.base_url`];

  if (!apiKey) {
    throw new Error(`配置缺失: ${scenario}.api_key`);
  }
  if (!model) {
    throw new Error(`配置缺失: ${scenario}.model`);
  }
  if (!baseUrl) {
    throw new Error(`配置缺失: ${scenario}.base_url`);
  }

  // 解析可选配置
  const temperature = values[`${scenario}.temperature`]
    ? parseFloat(values[`${scenario}.temperature`]!)
    : undefined;
  const maxTokens = values[`${scenario}.max_tokens`]
    ? parseInt(values[`${scenario}.max_tokens`]!, 10)
    : undefined;
  const dimensions = values[`${scenario}.dimensions`]
    ? parseInt(values[`${scenario}.dimensions`]!, 10)
    : undefined;

  return {
    api_key: apiKey,
    model,
    base_url: baseUrl,
    temperature,
    max_tokens: maxTokens,
    ...(dimensions !== undefined && { dimensions }),
  };
}

/**
 * 获取配置值（数字类型）
 */
export async function getAIConfigNumber(
  key: string,
  defaultValue?: number
): Promise<number | null> {
  const value = await getAIConfigValue(key);
  if (!value) {
    return defaultValue ?? null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? (defaultValue ?? null) : num;
}

/**
 * 获取配置值（整数类型）
 */
export async function getAIConfigInt(
  key: string,
  defaultValue?: number
): Promise<number | null> {
  const value = await getAIConfigValue(key);
  if (!value) {
    return defaultValue ?? null;
  }
  const num = parseInt(value, 10);
  return isNaN(num) ? (defaultValue ?? null) : num;
}
