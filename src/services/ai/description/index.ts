/**
 * Claude 服务 - 文章描述生成
 * 使用 LangChain.js 规范
 */

import {
  createAIChain,
  streamFromChain,
  type AIModelConfig
} from '@/lib/ai';
import { createBasePrompt, createChineseSystemInstruction } from '../utils/prompt';

/**
 * 文章描述生成输入参数
 */
interface DescriptionInput extends Record<string, unknown> {
  content: string;
}

/**
 * 文章描述生成提示词模板
 * 注意：Anthropic API 只允许一条 system 消息在开头
 */
const descriptionPrompt = createBasePrompt(
  createChineseSystemInstruction(
    `你是一个文章描述生成器。
请你以主人公第一人称的视角描述这篇文章的内容，简洁的描述，可以艺术加工而不是流水账，不要纯文本格式不要用Markdown语法，描述不超过100个字符。`
  ),
  '{content}'
);

/**
 * 文章描述生成模型配置
 * 注意：使用函数获取配置，避免构建时访问环境变量
 */
const getDescriptionModelConfig = (): AIModelConfig => {
  return {
    model: process.env.ANTHROPIC_MODEL_NAME || 'claude-haiku-4-5-20251001',
    temperature: 0.9,
    maxTokens: 1000,
  };
};

/**
 * 生成文章描述（流式）
 * @param content 文章内容
 * @returns ReadableStream 流式响应
 */
export const generDescriptionStream = async (content: string): Promise<ReadableStream> => {
  // 在运行时创建链，避免构建时访问环境变量
  const descriptionChain = createAIChain<DescriptionInput>(
    descriptionPrompt,
    getDescriptionModelConfig(),
    'anthropic'
  );
  
  return streamFromChain(descriptionChain, { content });
};
