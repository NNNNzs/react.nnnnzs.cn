/**
 * Agent 流式共享层
 *
 * 统一 chat-agent 与 create-agent 的：
 * - chunk 解析（reasoning / content / observation）
 * - streamEvents → SSE 帧产出
 * - 事件命名与字段（startedAt / endedAt / durationMs、统一 content_chunk / patch）
 *
 * @module agent-stream
 */

export {
  getRecord,
  getStringField,
  extractTextContent,
  extractReasoningContent,
  extractObservationText,
} from './chunk-parsers';

export {
  truncate,
  createSseEmitter,
  pumpAgentEvents,
} from './sse-emitter';

export type { SseEmitter, PumpAgentEventsOptions } from './sse-emitter';
