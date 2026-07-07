/**
 * 标准 SSE（Server-Sent Events）公用基础设施
 *
 * 作为站点级流式协议，区别于 src/lib/stream.ts 的自定义 XML 标签协议。
 * create-agent 首批接入，chat-agent 后续迁移复用。
 *
 * 协议：Content-Type: text/event-stream，每帧
 *   event: <eventName>\n
 *   data: <jsonString>\n
 *   \n
 */

/** SSE 事件名。内置通用事件 + 允许业务自定义（如 draft_patch） */
export type SSEEvent =
  | 'meta'
  | 'token'
  | 'tool_start'
  | 'tool_end'
  | 'error'
  | 'done'
  | (string & {}); // 业务自定义事件兜底

/** 一帧解析后的原始结构 */
export interface SSERawFrame {
  event: string;
  data: string;
}

/**
 * 编码一帧 SSE。
 * data 会被 JSON.stringify，换行符已自动转义，无需手动处理。
 * 返回值以 `\n\n` 结尾，可直接 enqueue 到 ReadableStream。
 */
export function encodeSSE(event: SSEEvent, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * 构造标准 SSE Response。
 *
 * 与 src/lib/stream.ts 的 createStreamResponse 区别：
 * 这里 Content-Type 固定为 text/event-stream，且禁用所有缓冲。
 */
export function createSSEResponse(
  stream: ReadableStream<Uint8Array>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...extraHeaders,
    },
  });
}

/**
 * 前端用：解析 fetch Response 的 SSE 字节流，逐帧回调。
 *
 * 不使用 EventSource（不支持 POST + 自定义 header），改用 fetch + ReadableStream 手动切帧。
 * 按 `\n\n` 切割事件边界，提取 `event:` 与 `data:` 行。
 * 支持 AbortSignal 中断。
 */
export async function parseSSEStream(
  response: Response,
  onFrame: (frame: SSERawFrame) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!response.body) {
    throw new Error('SSE 响应没有 body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const flushFrame = (raw: string) => {
    const frame = parseSSEFrame(raw);
    if (frame) onFrame(frame);
  };

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 按 \n\n 切帧；保留最后一段未闭合的 buffer
      let sepIndex: number;
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawFrame = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        flushFrame(rawFrame);
      }
    }

    // 收尾：flush 残留 buffer（部分服务端可能末尾未带 \n\n）
    buffer += decoder.decode();
    if (buffer.trim()) flushFrame(buffer);
  } finally {
    reader.releaseLock();
  }
}

/** 解析单帧文本为 { event, data }；不合法返回 null */
function parseSSEFrame(raw: string): SSERawFrame | null {
  const lines = raw.split('\n');
  let event = 'message'; // SSE 默认事件名
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) continue; // 空行 / 注释
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

/** 尝试把 SSE data 解析为 JSON；失败则原样返回字符串 */
export function parseSSEData<T = unknown>(data: string): T | string {
  try {
    return JSON.parse(data) as T;
  } catch {
    return data;
  }
}
