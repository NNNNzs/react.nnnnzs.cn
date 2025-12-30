/**
 * AI文本处理服务
 * 使用 LangChain.js 规范
 * 默认使用流式响应
 */

import { 
  ChatPromptTemplate,
  createAIChain,
  streamFromChain,
  type AIModelConfig
} from '@/lib/ai';
import { AI_PROMPTS, type AIProcessParams, type AIActionType } from '@/lib/ai-text';
import { 
  createBasePrompt, 
  createPromptWithContext, 
  createChineseSystemInstruction 
} from '../utils/prompt';

/**
 * AI 文本处理输入参数
 */
interface AITextInput extends Record<string, unknown> {
  instruction: string;
  text: string;
  context?: string;
}

/**
 * AI 文本处理模型配置
 */
const aiTextModelConfig: AIModelConfig = {
  model: 'claude-haiku-4-5-20251001',
  temperature: 0.7,
  maxTokens: 2000,
};

/**
 * 创建 AI 文本处理提示词模板
 * 根据是否有上下文动态选择模板
 * @param hasContext 是否有上下文
 * @param instruction 处理指令
 * @returns ChatPromptTemplate
 */
const createAITextPrompt = (hasContext: boolean, instruction: string): ChatPromptTemplate => {
  const systemInstruction = createChineseSystemInstruction(instruction);
  
  if (hasContext) {
    return createPromptWithContext(systemInstruction, '{context}', '{text}');
  }
  
  return createBasePrompt(systemInstruction, '{text}');
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
export const processAITextStream = async (params: AIProcessParams): Promise<ReadableStream> => {
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
  
  // 根据是否有上下文创建不同的提示词模板
  const hasContext = !!context;
  const prompt = createAITextPrompt(hasContext, instruction);
  
  // 创建 LCEL 链
  const chain = createAIChain<AITextInput>(prompt, aiTextModelConfig);
  
  // 构建输入参数
  const input: AITextInput = {
    instruction,
    text,
    ...(hasContext && { context }),
  };

  return streamFromChain(chain, input);
};
