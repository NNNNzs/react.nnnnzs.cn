/**
 * Anthropic 官方 SDK 客户端
 * 使用 @anthropic-ai/sdk 直接调用，支持中转服务
 */

import { Anthropic } from '@anthropic-ai/sdk';

/**
 * 获取 Anthropic 客户端实例
 * 使用函数延迟初始化，避免构建时访问环境变量
 */
export const getAnthropicClient = (): Anthropic => {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  });
};

/**
 * Anthropic 模型配置
 */
export interface AnthropicModelConfig {
  /** 模型名称 */
  model?: string;
  /** 温度参数 */
  temperature?: number;
  /** 最大 token 数 */
  maxTokens?: number;
}

/**
 * 默认模型配置
 */
export const DEFAULT_ANTHROPIC_CONFIG: AnthropicModelConfig = {
  model: 'claude-haiku-4-5-20251001',
  temperature: 0.7,
  maxTokens: 2000,
};
