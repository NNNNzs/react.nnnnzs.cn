/**
 * 流式响应处理工具函数
 */

/**
 * 处理流式响应的选项
 */
export interface StreamProcessOptions {
  /**
   * 文本增量回调函数，每次收到新的文本块时调用
   */
  onChunk?: (chunk: string) => void;
  
  /**
   * 完成回调函数，流处理完成时调用
   */
  onComplete?: (fullText: string) => void;
  
  /**
   * 错误回调函数，处理错误时调用
   */
  onError?: (error: Error) => void;
}

/**
 * 处理流式响应
 * @param response Fetch Response 对象
 * @param options 处理选项
 * @returns Promise<string> 完整的文本内容
 */
export const processStreamResponse = async (
  response: Response,
  options: StreamProcessOptions = {}
): Promise<string> => {
  const { onChunk, onComplete, onError } = options;

  if (!response.ok) {
    const error = new Error(`HTTP error! status: ${response.status}`);
    onError?.(error);
    throw error;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const error = new Error('无法读取响应流');
    onError?.(error);
    throw error;
  }

  const decoder = new TextDecoder();
  let accumulatedText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // 解码并累积文本
      const chunk = decoder.decode(value, { stream: true });
      accumulatedText += chunk;
      
      // 调用增量回调
      onChunk?.(chunk);
    }

    // 调用完成回调
    onComplete?.(accumulatedText);
    
    return accumulatedText;
  } catch (error) {
    const err = error instanceof Error ? error : new Error('处理流式响应时发生未知错误');
    onError?.(err);
    throw err;
  }
};

/**
 * 从 API 获取流式响应并处理
 * @param url API 地址
 * @param options 请求选项
 * @param streamOptions 流处理选项
 * @returns Promise<string> 完整的文本内容
 */
export const fetchAndProcessStream = async (
  url: string,
  options: RequestInit = {},
  streamOptions: StreamProcessOptions = {}
): Promise<string> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return processStreamResponse(response, streamOptions);
};
