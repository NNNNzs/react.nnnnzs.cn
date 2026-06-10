/**
 * @deprecated Chat Agent 已迁移到 `src/services/ai/chat-agent`。
 * 这里保留兼容导出，避免旧调用方在迁移期断裂。
 */

export {
  chatAgentStream,
  chatRAGAgentStream,
} from '@/services/ai/chat-agent';
export type {
  ChatAgentParams,
  RAGAgentParams,
} from '@/services/ai/chat-agent';
