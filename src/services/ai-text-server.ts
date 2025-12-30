/**
 * AI文本处理服务 - 服务器端
 * 包含 Anthropic SDK 调用，只能在服务器端使用
 * 默认使用流式响应
 */

import { Anthropic } from '@anthropic-ai/sdk';
import type { AIProcessParams } from './ai-text';

// 服务器端初始化 Anthropic 客户端
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

/**
 * Anthropic MessageStream 类型
 */
type MessageStream = Awaited<ReturnType<typeof anthropic.messages.stream>>;

/**
 * 处理 Anthropic 流式响应，提取文本增量
 * @param stream Anthropic MessageStream 对象
 * @param onTextDelta 文本增量回调函数
 * @returns Promise<void>
 */
export const processAnthropicStream = async (
  stream: MessageStream,
  onTextDelta: (text: string) => void
): Promise<void> => {
  try {
    for await (const event of stream) {
      // 处理 content_block_delta 事件
      if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if (delta.type === 'text_delta' && delta.text) {
          onTextDelta(delta.text);
        }
      }
      // message_stop 事件表示流结束
      if (event.type === 'message_stop') {
        break;
      }
    }
  } catch (error) {
    console.error('处理 Anthropic 流式响应错误:', error);
    throw error;
  }
};

/**
 * 将 Anthropic 流转换为 ReadableStream
 * @param stream Anthropic MessageStream 对象
 * @returns ReadableStream
 */
export const convertAnthropicStreamToReadableStream = (stream: MessageStream): ReadableStream => {
  return new ReadableStream({
    async start(controller) {
      try {
        let hasSentData = false;
        
        await processAnthropicStream(stream, (text) => {
          hasSentData = true;
          controller.enqueue(new TextEncoder().encode(text));
        });
        
        // 如果没有发送任何数据，至少发送一个空字符串
        if (!hasSentData) {
          console.warn('流式响应没有发送任何数据');
          controller.enqueue(new TextEncoder().encode(''));
        }
        
        controller.close();
      } catch (error) {
        console.error('流式响应错误:', error);
        const errorMessage = error instanceof Error ? error.message : 'AI处理失败';
        try {
          controller.enqueue(new TextEncoder().encode(`错误: ${errorMessage}`));
          controller.close();
        } catch {
          // 如果控制器已关闭或出错，尝试关闭
          try {
            controller.close();
          } catch {
            // 忽略关闭错误
          }
        }
      }
    },
  });
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

  // 导入提示词模板
  const { AI_PROMPTS } = await import('./ai-text');
  const prompt = AI_PROMPTS[action];
  const fullPrompt = context 
    ? `${prompt}\n\n上下文信息：${context}\n\n需要处理的文本：${text}`
    : `${prompt}\n\n${text}`;

  const stream = await anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    temperature: 0.7,
    messages: [
      { role: 'assistant', content: 'always answer in Chinese' },
      { role: 'user', content: fullPrompt }
    ],
  });

  return convertAnthropicStreamToReadableStream(stream);
};
