/**
 * 文章描述生成服务
 * 使用 OpenAI + LangChain，从数据库读取配置
 */

import { ChatPromptTemplate, createAIChain, streamFromChain } from '@/lib/ai';

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

  // 创建提示词模板
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemInstruction],
    ['human', '{content}'],
  ]);
  
  // 创建带文本提取器的链（从数据库读取 description.* 配置）
  const chain = await createAIChain<{ content: string }>(prompt, {
    scenario: 'description',
  });

  // 流式执行，输出纯文本字符串
  return streamFromChain(chain, { content });
};
