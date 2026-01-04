/**
 * Claude 服务 - 文章描述生成
 * 使用官方 @anthropic-ai/sdk
 */

import {
  streamAnthropicMessagesWithSystem,
  type AnthropicModelConfig,
} from '../anthropic';

/**
 * 文章描述生成模型配置
 * 注意：使用函数获取配置，避免构建时访问环境变量
 */
const getDescriptionModelConfig = (): AnthropicModelConfig => {
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
export const generDescriptionStream = async (
  content: string
): Promise<ReadableStream> => {
  const systemInstruction = `请使用中文回复。

你是一个文章描述生成器。
请你以主人公第一人称的视角描述这篇文章的内容，简洁的描述，可以艺术加工而不是流水账，不要纯文本格式不要用Markdown语法，描述不超过100个字符。`;

  const messages = [
    {
      role: 'user' as const,
      content: content,
    },
  ];

  return streamAnthropicMessagesWithSystem(
    systemInstruction,
    messages,
    getDescriptionModelConfig()
  );
};
