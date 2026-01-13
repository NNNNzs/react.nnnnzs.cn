/**
 * SSE (Server-Sent Events) 工具函数
 * 用于服务端和客户端的 SSE 通信
 */

import type { SSEEvent } from './react-agent';

/**
 * 格式化 SSE 消息
 * @param event 事件类型
 * @param data 数据（将被序列化为 JSON）
 * @returns SSE 格式的字符串
 */
export function formatSSEMessage(event: string, data: unknown): string {
  const jsonData = JSON.stringify(data);
  return `event: ${event}\ndata: ${jsonData}\n\n`;
}

/**
 * 创建 SSE ReadableStream
 * @param onStart 启动回调，接收 send 函数用于发送事件
 * @returns ReadableStream
 */
export function createSSEStream(
  onStart: (send: (event: SSEEvent) => void) => Promise<void>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // 定义发送函数
        const send = (event: SSEEvent) => {
          const message = formatSSEMessage(event.type, event.data);
          controller.enqueue(encoder.encode(message));
        };

        // 执行业务逻辑
        await onStart(send);

        // 发送完成标记
        const doneMessage = formatSSEMessage('done', null);
        controller.enqueue(encoder.encode(doneMessage));

        controller.close();
      } catch (error) {
        console.error('❌ SSE 流错误:', error);
        
        // 发送错误事件
        const errorMessage = formatSSEMessage('error', {
          message: error instanceof Error ? error.message : '未知错误',
        });
        controller.enqueue(encoder.encode(errorMessage));
        
        controller.close();
      }
    },
    cancel() {
      console.log('⚠️ SSE 流被取消');
    },
  });
}

/**
 * 创建 SSE Response
 * @param stream SSE ReadableStream
 * @returns Response
 */
export function createSSEResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * SSE 事件处理器
 */
export interface SSEEventHandlers {
  onThought?: (data: string) => void | Promise<void>;
  onAction?: (data: { method: string; params: Record<string, unknown>; id: string | number }) => void | Promise<void>;
  onObservation?: (data: unknown) => void | Promise<void>;
  onAnswer?: (data: string) => void | Promise<void>;
  onError?: (data: { message: string }) => void | Promise<void>;
  onDone?: () => void | Promise<void>;
}

/**
 * 解析 SSE 事件流（客户端使用）
 * @param response Fetch Response
 * @param handlers 事件处理器
 */
export async function parseSSEStream(
  response: Response,
  handlers: SSEEventHandlers
): Promise<void> {
  if (!response.ok) {
    // 尝试解析错误响应
    try {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    } catch {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('无法读取响应流');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let hasReceivedData = false;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // 如果流结束但没有收到任何数据，可能是连接问题
        if (!hasReceivedData) {
          console.warn('⚠️ SSE 流结束，但未收到任何数据');
        }
        break;
      }

      hasReceivedData = true;

      // 解码并添加到缓冲区
      buffer += decoder.decode(value, { stream: true });

      // 按行分割处理
      const lines = buffer.split('\n');
      
      // 保留最后一个不完整的行
      buffer = lines.pop() || '';

      let currentEvent = '';
      let currentData = '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.substring(6).trim();
        } else if (line.startsWith('data:')) {
          currentData = line.substring(5).trim();
        } else if (line === '') {
          // 空行表示一个事件结束
          if (currentEvent && currentData) {
            await handleSSEEvent(currentEvent, currentData, handlers);
          }
          currentEvent = '';
          currentData = '';
        }
      }
    }
  } catch (error) {
    console.error('❌ 解析 SSE 流错误:', error);
    
    // 调用错误处理器
    if (error instanceof Error) {
      await handlers.onError?.({ message: error.message });
    }
    
    throw error;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // 忽略 release 错误
    }
  }
}

/**
 * 处理单个 SSE 事件
 */
async function handleSSEEvent(
  event: string,
  data: string,
  handlers: SSEEventHandlers
): Promise<void> {
  try {
    const parsedData = JSON.parse(data);

    switch (event) {
      case 'thought':
        await handlers.onThought?.(parsedData);
        break;
      case 'action':
        await handlers.onAction?.(parsedData);
        break;
      case 'observation':
        await handlers.onObservation?.(parsedData);
        break;
      case 'answer':
        await handlers.onAnswer?.(parsedData);
        break;
      case 'error':
        await handlers.onError?.(parsedData);
        break;
      case 'done':
        await handlers.onDone?.();
        break;
      default:
        console.warn('⚠️ 未知的 SSE 事件类型:', event);
    }
  } catch (error) {
    console.error('❌ 处理 SSE 事件错误:', error);
  }
}
