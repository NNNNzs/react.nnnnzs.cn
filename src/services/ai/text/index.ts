/**
 * AI文本处理服务
 * 使用官方 @anthropic-ai/sdk
 * 默认使用流式响应
 */

import {
  streamAnthropicMessagesWithSystem,
  type AnthropicModelConfig,
} from '../anthropic';
import { AI_PROMPTS, type AIProcessParams, type AIActionType } from '@/lib/ai-text';

/**
 * AI 文本处理模型配置
 */
const aiTextModelConfig: AnthropicModelConfig = {
  model: 'claude-haiku-4-5-20251001',
  temperature: 0.7,
  maxTokens: 2000,
};

/**
 * 获取指定 action 的提示词指令
 * @param action AI 操作类型
 * @returns 提示词指令
 */
const getInstructionForAction = (action: AIActionType): string => {
  return AI_PROMPTS[action];
};

/**
 * AI文本处理（流式）
 * @param params 处理参数
 * @returns ReadableStream 流式响应
 */
export const processAITextStream = async (
  params: AIProcessParams
): Promise<ReadableStream> => {
  const { text, action, context } = params;

  // 输入验证
  if (!text || text.trim().length === 0) {
    throw new Error('文本内容不能为空');
  }

  if (text.length > 5000) {
    throw new Error('文本长度超过限制（5000字符）');
  }

  // 获取指令
  const instruction = getInstructionForAction(action);

  // 构建系统指令
  const systemInstruction = `请使用中文回复。

${instruction}`;

  // 构建用户消息
  let userContent = '';
  if (context) {
    userContent = `上下文信息：${context}\n\n需要处理的文本：${text}`;
  } else {
    userContent = text;
  }

  const messages = [
    {
      role: 'user' as const,
      content: userContent,
    },
  ];

  return streamAnthropicMessagesWithSystem(
    systemInstruction,
    messages,
    aiTextModelConfig
  );
};
