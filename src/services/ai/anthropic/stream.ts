/**
 * Anthropic 流式响应处理
 * 使用官方 SDK 的流式 API
 */

import { getAnthropicClient } from './client';
import type { AnthropicModelConfig } from './client';

/**
 * Anthropic MessageStream 类型
 */
type MessageStream = Awaited<
  ReturnType<ReturnType<typeof getAnthropicClient>['messages']['stream']>
>;

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
    let eventCount = 0;
    let deltaCount = 0;
    
    for await (const event of stream) {
      eventCount++;
      
      // 处理 content_block_delta 事件
      if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if (delta.type === 'text_delta' && delta.text) {
          deltaCount++;
          onTextDelta(delta.text);
          
          // 前几个和每 10 个输出一次日志
          if (deltaCount <= 3 || deltaCount % 10 === 0) {
            console.log(`📤 Anthropic 流式响应第 ${deltaCount} 个增量，长度: ${delta.text.length}`);
          }
        }
      }
      
      // message_stop 事件表示流结束
      if (event.type === 'message_stop') {
        console.log(`✅ Anthropic 流式响应完成，共处理 ${eventCount} 个事件，${deltaCount} 个文本增量`);
        break;
      }
    }
    
    if (deltaCount === 0) {
      console.warn('⚠️ 警告：Anthropic 流式响应没有返回任何文本增量');
    }
  } catch (error) {
    console.error('❌ 处理 Anthropic 流式响应错误:', error);
    if (error instanceof Error) {
      console.error('错误堆栈:', error.stack);
    }
    throw error;
  }
};

/**
 * 将 Anthropic 流转换为 ReadableStream
 * @param stream Anthropic MessageStream 对象
 * @returns ReadableStream
 */
export const convertAnthropicStreamToReadableStream = (
  stream: MessageStream
): ReadableStream => {
  return new ReadableStream({
    async start(controller) {
      try {
        let hasSentData = false;
        let totalBytes = 0;

        console.log('🔄 开始处理 Anthropic 流式响应...');
        
        await processAnthropicStream(stream, (text) => {
          hasSentData = true;
          const encoded = new TextEncoder().encode(text);
          totalBytes += encoded.length;
          controller.enqueue(encoded);
        });

        // 如果没有发送任何数据，记录警告
        if (!hasSentData) {
          console.warn('⚠️ 流式响应没有发送任何数据');
          // 不发送空字符串，让调用方处理
        } else {
          console.log(`✅ Anthropic ReadableStream 完成，共发送 ${totalBytes} 字节`);
        }

        controller.close();
      } catch (error) {
        console.error('❌ 流式响应错误:', error);
        const errorMessage =
          error instanceof Error ? error.message : '生成失败';
        try {
          controller.enqueue(
            new TextEncoder().encode(`错误: ${errorMessage}`)
          );
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
    cancel() {
      console.log('⚠️ Anthropic ReadableStream 被取消');
    },
  });
};

/**
 * 调用 Anthropic API 生成流式响应
 * @param messages 消息数组
 * @param config 模型配置
 * @returns ReadableStream
 */
export const streamAnthropicMessages = async (
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>,
  config: AnthropicModelConfig = {}
): Promise<ReadableStream> => {
  const anthropic = getAnthropicClient();
  const mergedConfig = {
    model: config.model || 'claude-haiku-4-5-20251001',
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 2000,
  };

  const stream = await anthropic.messages.stream({
    ...mergedConfig,
    messages,
  });

  return convertAnthropicStreamToReadableStream(stream);
};

/**
 * 调用 Anthropic API 生成流式响应（带 system 消息）
 * @param system 系统消息
 * @param messages 消息数组
 * @param config 模型配置
 * @returns ReadableStream
 */
export const streamAnthropicMessagesWithSystem = async (
  system: string,
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>,
  config: AnthropicModelConfig = {}
): Promise<ReadableStream> => {
  const anthropic = getAnthropicClient();
  const mergedConfig = {
    model: config.model || 'claude-haiku-4-5-20251001',
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 2000,
  };

  const stream = await anthropic.messages.stream({
    ...mergedConfig,
    system,
    messages,
  });

  return convertAnthropicStreamToReadableStream(stream);
};
