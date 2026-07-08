/**
 * AI 模型配置读取工具
 * 从数据库读取配置，支持缓存，避免频繁查询
 *
 * 配置来源已重构为「Provider + 场景绑定」两张表：
 *  - getAIConfig(scenario) 读取该场景 is_active=true 的绑定，join provider 拿 base_url/api_key
 *  - 旧的 tbConfig JSON profile（ai.profile_groups 等）已废弃
 */

import { configByKeys } from '@/services/config';
import {
  getActiveBinding,
  listBindingsByScenario,
  type AiBindingWithProvider,
} from '@/services/ai-scenario-binding';

/**
 * AI 配置场景类型
 */
export type AIConfigScenario = string;

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
  api_mode?: string; // 仅用于 image_gen
  voice?: string; // 仅用于 tts
}

/** 把场景绑定（带 provider）解析为 AIConfig */
function bindingToAIConfig(scenario: AIConfigScenario, binding: AiBindingWithProvider | null): AIConfig {
  if (!binding) {
    throw new Error(`AI 场景未配置或未激活: ${scenario}`);
  }

  const apiKey = binding.provider.api_key;
  const baseUrl = binding.provider.base_url;
  const model = binding.model;

  if (!apiKey) {
    throw new Error(`AI 场景 ${scenario} 的供应商缺少 api_key`);
  }
  if (!baseUrl) {
    throw new Error(`AI 场景 ${scenario} 的供应商缺少 base_url`);
  }
  if (!model) {
    throw new Error(`AI 场景 ${scenario} 的绑定缺少 model`);
  }

  return {
    api_key: apiKey,
    model,
    base_url: baseUrl,
    ...(binding.temperature !== null && { temperature: binding.temperature }),
    ...(binding.max_tokens !== null && { max_tokens: binding.max_tokens }),
    ...(binding.dimensions !== null && { dimensions: binding.dimensions }),
    ...(binding.api_mode && { api_mode: binding.api_mode }),
    ...(binding.voice && { voice: binding.voice }),
  };
}

/**
 * 内存缓存（简单实现，生产环境可考虑使用 Redis）
 */
const configCache = new Map<string, { value: string | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

/**
 * 清除缓存（含单项值缓存与场景级 AIConfig 缓存）
 */
export function clearAIConfigCache(): void {
  configCache.clear();
  scenarioConfigCache.clear();
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

/** 场景级 AIConfig 缓存（按 scenario），TTL 5 分钟；切换激活后由 activate 接口调用 clearAIConfigCache 失效 */
const scenarioConfigCache = new Map<string, { value: AIConfig; timestamp: number }>();
const SCENARIO_CACHE_TTL = 5 * 60 * 1000;

/**
 * 获取指定场景的完整 AI 配置（读激活绑定）。
 * @param scenario 配置场景
 */
export async function getAIConfig(scenario: AIConfigScenario): Promise<AIConfig> {
  const cached = scenarioConfigCache.get(scenario);
  if (cached && Date.now() - cached.timestamp < SCENARIO_CACHE_TTL) {
    return cached.value;
  }

  const binding = await getActiveBinding(scenario);
  if (!binding) {
    throw new Error(`AI 场景未配置或未激活，请在配置管理中为 ${scenario} 绑定并激活一个配置`);
  }

  const config = bindingToAIConfig(scenario, binding);
  scenarioConfigCache.set(scenario, { value: config, timestamp: Date.now() });
  return config;
}

/**
 * 获取指定场景的全部候选配置（激活项在前），用于失败重试/降级。
 */
export async function getAIConfigCandidates(scenario: AIConfigScenario): Promise<AIConfig[]> {
  const bindings = await listBindingsByScenario(scenario);
  if (bindings.length === 0 || !bindings.some((b) => b.is_active)) {
    throw new Error(`AI 场景未配置或未激活，请在配置管理中为 ${scenario} 绑定并激活一个配置`);
  }
  return bindings.map((b) => bindingToAIConfig(scenario, b));
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
