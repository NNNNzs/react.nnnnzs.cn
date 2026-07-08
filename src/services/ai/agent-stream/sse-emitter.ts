/**
 * Agent SSE 事件泵 — 共享层
 *
 * 把 LangGraph `agent.streamEvents()` 的事件流，统一转换成标准 SSE 帧
 * （meta / think_start / think_chunk / think_end / tool_start / tool_end /
 * content_chunk / patch / done / error），写入给定的 ReadableStream controller。
 *
 * chat-agent 与 create-agent 共用此模块，保证两端：
 * - 思考（reasoning）提取逻辑一致
 * - 工具事件字段一致（startedAt / endedAt / durationMs）
 * - 事件命名一致（统一 content_chunk、patch）
 *
 * @module agent-stream/sse-emitter
 */

import { encodeSSE } from '@/lib/sse';
import {
  extractReasoningContent,
  extractTextContent,
  extractObservationText,
  getRecord,
  getStringField,
} from './chunk-parsers';

/** 工具结果截断，避免超长 output 塞爆 SSE 帧 */
export function truncate(text: string, max = 2000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…（已截断，共 ${text.length} 字符）`;
}

/** SSE 发射器：封装对 controller 的安全写入 */
export interface SseEmitter {
  /** 写一帧 SSE；流已关闭时静默跳过 */
  enqueue: (event: string, data: unknown) => void;
}

/**
 * 创建 SSE 发射器。
 *
 * 流可能因客户端断开进入 closed/errored 态，此时 enqueue 会抛 TypeError；
 * 用 desiredSize 判断 + try/catch 兜底，避免异常逸出。
 */
export function createSseEmitter(
  controller: ReadableStreamDefaultController,
  tag = 'agent',
): SseEmitter {
  const encoder = new TextEncoder();
  return {
    enqueue(event, data) {
      if (controller.desiredSize === null) return;
      try {
        controller.enqueue(encoder.encode(encodeSSE(event, data)));
      } catch (err) {
        // 流已关闭，静默
        console.warn(`[${tag}] enqueue 失败（流已关闭）:`, err);
      }
    },
  };
}

/** streamEvents 事件项的最小类型 */
interface StreamEvent {
  event: string;
  data?: unknown;
  name?: string;
  run_id?: string;
}

/** pumpAgentEvents 选项 */
export interface PumpAgentEventsOptions {
  /** 场景标识，写入 meta 帧 */
  scenario: string;
  /** meta 帧的附加数据（如 draftId） */
  meta?: Record<string, unknown>;
  /**
   * 工具返回结果的解析器，默认 extractObservationText。
   * 不同 agent 的工具 output 形态不同时可自定义。
   */
  extractResult?: (data: unknown) => string;
  /**
   * 业务 patch 钩子（如 draft_patch）。
   * 返回的 patch 会作为 SSE `patch` 帧下发（事件名统一为 patch）。
   * 由调用方在工具执行时主动调用 emitter.enqueue('patch', ...) 亦可，
   * 此钩子用于把 streamEvents 中识别到的 patch 事件转出。
   */
}

/**
 * 驱动 LangGraph streamEvents，产出标准 SSE 帧并写入 emitter。
 *
 * 处理的事件：
 * - on_chat_model_stream：分离 reasoning（think_*）与文本（content_chunk）
 * - on_tool_start / on_tool_end：产出工具帧，跨 start/end 用 runId 配对计时
 *
 * 思考与文本/工具互斥切换：进入 think 时发 think_start，遇到 content 或 tool 时发 think_end。
 */
export async function pumpAgentEvents(
  eventStream: AsyncIterable<StreamEvent>,
  emitter: SseEmitter,
  options: PumpAgentEventsOptions,
): Promise<void> {
  const { scenario, meta = {}, extractResult = extractObservationText } = options;

  let inThink = false;
  let stepIndex = 0;
  const toolStepByRunId = new Map<string, number>();
  const toolMetaByRunId = new Map<string, {
    toolName: string;
    startedAt: string;
    startedAtMs: number;
  }>();

  const endThinkIfNeeded = () => {
    if (inThink) {
      emitter.enqueue('think_end', {});
      inThink = false;
    }
  };

  // 发送 meta 帧
  emitter.enqueue('meta', { scenario, ...meta });

  for await (const event of eventStream) {
    const { event: eventType, data } = event;

    if (eventType === 'on_chat_model_stream') {
      const chunk = getRecord(data)?.chunk;
      if (!chunk) continue;
      const chunkRecord = chunk;

      const reasoningContent = extractReasoningContent(chunkRecord);
      if (reasoningContent) {
        if (!inThink) {
          emitter.enqueue('think_start', {});
          inThink = true;
        }
        emitter.enqueue('think_chunk', { content: reasoningContent });
      }

      const content = extractTextContent(getRecord(chunkRecord)?.content);
      if (content) {
        endThinkIfNeeded();
        emitter.enqueue('content_chunk', { content });
      }
    }

    if (eventType === 'on_tool_start') {
      endThinkIfNeeded();

      const runId = getStringField(event, 'run_id') || `tool-${stepIndex + 1}`;
      const toolName = getStringField(event, 'name');
      const input = getRecord(getRecord(data)?.input) || {};
      const startedAtMs = Date.now();
      const startedAt = new Date(startedAtMs).toISOString();

      stepIndex++;
      toolStepByRunId.set(runId, stepIndex);
      toolMetaByRunId.set(runId, { toolName, startedAt, startedAtMs });

      emitter.enqueue('tool_start', {
        tool: toolName,
        args: input,
        step: stepIndex,
        runId,
        startedAt,
      });
    }

    if (eventType === 'on_tool_end') {
      endThinkIfNeeded();

      const runId = getStringField(event, 'run_id');
      const step = toolStepByRunId.get(runId) || stepIndex;
      const toolMeta = toolMetaByRunId.get(runId);
      const endedAtMs = Date.now();
      const endedAt = new Date(endedAtMs).toISOString();
      const durationMs = toolMeta ? endedAtMs - toolMeta.startedAtMs : undefined;

      emitter.enqueue('tool_end', {
        tool: toolMeta?.toolName || getStringField(event, 'name'),
        result: truncate(extractResult(data)),
        step,
        runId,
        endedAt,
        durationMs,
      });
    }
  }

  endThinkIfNeeded();
}
