import { Anthropic } from '@anthropic-ai/sdk';

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
        const errorMessage = error instanceof Error ? error.message : '生成描述失败';
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
 * 生成文章描述（流式）
 * @param content 文章内容
 * @returns ReadableStream 流式响应
 */
export const generDescriptionStream = async (content: string): Promise<ReadableStream> => {
  const stream = await anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    temperature: 0.9,
    messages: [
      { role: 'assistant', content: 'always answer in Chinese' },
      { role: 'assistant', content: `你是一个文章描述生成器，请你以主人公第一人称的视角描述这篇文章的内容，简洁的描述，可以艺术加工而不是流水账，不要纯文本格式不要用Markdown语法，描述不超过100个字符` },
      { role: 'user', content: content }
    ],
  });

  return convertAnthropicStreamToReadableStream(stream);
}