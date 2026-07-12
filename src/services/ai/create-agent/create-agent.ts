/**
 * 创作助手 Agent（SSE 版）
 *
 * 基于 LangGraph createReactAgent，输出标准 SSE 多事件流（src/lib/sse.ts）。
 * 流式产出（think / tool / content 帧的解析与 SSE 编码）由共享层
 * src/services/ai/agent-stream 统一处理，与 chat-agent 行为一致。
 *
 * 工具集按请求构建（buildCreateTools），注入 draftId/userId/emitPatch。
 * emit_draft_patch 工具触发时，patch 通过 emitPatch 推送为 SSE patch 帧。
 */

import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { createOpenAIModel } from '@/lib/ai';
import { getContentDraft } from '@/services/content-creation';
import { buildCreateAgentSystemPrompt } from './prompt';
import { buildCreateTools } from '../tools/create-tools/langchain-tools';
import type { DraftPatch } from '../tools/create-tools/draft-patch';
import type { CreateAgentPageContext } from '@/types/create-agent';
import {
  createSseEmitter,
  pumpAgentEvents,
  getRecord,
} from '@/services/ai/agent-stream';
import { createLangGraphDebugger } from '@/services/ai/langgraph-debugger';
import { withPhoenixAgentTrace } from '@/lib/phoenix-observability';

export interface CreateAgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CreateAgentStreamParams {
  draftId: number;
  userId: number;
  message: string;
  history?: CreateAgentMessage[];
  pageContext?: CreateAgentPageContext;
}

const SCENARIO = 'create_agent';
const MAX_RUNTIME_CONTEXT_LENGTH = 24000;
const MAX_DRAFT_BODY_CONTEXT_LENGTH = 18000;

function truncateContext(value: string, maxLength: number): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength)}\n\n[上下文已截断]`
    : value;
}

function buildMessages(
  question: string,
  history: CreateAgentMessage[] = [],
): Array<HumanMessage | AIMessage> {
  const messages: Array<HumanMessage | AIMessage> = [];
  for (const h of history) {
    messages.push(h.role === 'user' ? new HumanMessage(h.content) : new AIMessage(h.content));
  }
  messages.push(new HumanMessage(question));
  return messages;
}

function readPageContextSource(
  draft: {
    title: string;
    hook: string | null;
    body: string | null;
    tags_json: unknown;
    type: string;
    status: string;
  },
  pageContext: CreateAgentPageContext | undefined,
) {
  const databaseContext: CreateAgentPageContext = {
    title: draft.title,
    hook: draft.hook ?? '',
    body: draft.body ?? '',
    tags: Array.isArray(draft.tags_json)
      ? draft.tags_json.filter((item): item is string => typeof item === 'string')
      : [],
    type: draft.type,
    status: draft.status,
  };

  if (!pageContext) return { contextSource: 'database' as const, currentDraft: databaseContext };

  const isChanged = pageContext.title !== databaseContext.title
    || pageContext.hook !== databaseContext.hook
    || pageContext.body !== databaseContext.body
    || pageContext.type !== databaseContext.type
    || pageContext.status !== databaseContext.status
    || pageContext.tags.join('\u0000') !== databaseContext.tags.join('\u0000');

  return {
    contextSource: isChanged ? 'page' as const : 'database' as const,
    currentDraft: isChanged ? pageContext : databaseContext,
  };
}

/**
 * 创作助手工具返回结果解析器。
 *
 * 创作工具（emit_draft_patch / generate_image / poll_image_job 等）的 output
 * 不是检索 JSON，而是普通对象或字符串，因此直接 stringify 后截断。
 */
function extractCreateToolResult(data: unknown): string {
  const output = getRecord(data)?.output;
  if (!output) return '';
  if (typeof output === 'string') return output;
  return JSON.stringify(output);
}

/**
 * 运行创作助手，产出 SSE 字节流。
 * 流内容是已编码的 SSE 帧字符串（event + data）。
 */
export async function createAgentStream(
  params: CreateAgentStreamParams,
): Promise<ReadableStream<Uint8Array>> {
  const { draftId, userId, message, history = [], pageContext } = params;

  if (!message?.trim()) {
    throw new Error('消息内容不能为空');
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emitter = createSseEmitter(controller, 'create-agent');
      const debugLogger = createLangGraphDebugger({
        agentName: 'create-agent',
        metadata: { draftId, userId },
      });

      // emitPatch：把草稿 patch 作为 patch 帧推到当前流
      // （事件名统一为 patch，前端 useAgentStream 监听 patch）
      const emitPatch = (patch: DraftPatch) => {
        void debugLogger.log('draft_patch', patch);
        emitter.enqueue('patch', patch);
      };

      try {
        // 读取数据库草稿用于权限外的基础事实，并在页面快照出现改动时优先使用实时内容。
        const draft = await getContentDraft(draftId);
        if (!draft) throw new Error('草稿不存在');
        const snapshot = getRecord(draft.generation_snapshot_json) ?? {};
        const topicSnapshot = getRecord(snapshot.topicSnapshot);
        const { contextSource, currentDraft } = readPageContextSource(draft, pageContext);
        const runtimeContext = truncateContext(JSON.stringify({
          platform: draft.platform,
          type: currentDraft.type,
          contextSource,
          topic: topicSnapshot ?? null,
          currentDraft: {
            ...currentDraft,
            body: truncateContext(currentDraft.body, MAX_DRAFT_BODY_CONTEXT_LENGTH),
          },
        }), MAX_RUNTIME_CONTEXT_LENGTH);
        const systemPrompt = await buildCreateAgentSystemPrompt({
          draftTitle: currentDraft.title,
          draftType: currentDraft.type,
          contextSource,
          runtimeContext,
        });

        const model = await createOpenAIModel({ scenario: SCENARIO });
        const tools = buildCreateTools({ draftId, userId, emitPatch });

        const agent = createReactAgent({
          llm: model.bindTools(tools),
          tools,
          prompt: systemPrompt,
        });

        const messages = buildMessages(message, history);
        await withPhoenixAgentTrace({
          name: 'create-agent',
          userId,
          metadata: {
            scenario: SCENARIO,
            draftId,
            platform: draft.platform,
            draftType: currentDraft.type,
            contextSource,
            route: '/api/create/drafts/:id/chat',
          },
        }, async () => {
          const eventStream = agent.streamEvents({ messages }, {
            version: 'v2',
            runName: 'create-agent',
            tags: ['agent', 'create-agent', draft.platform],
            metadata: {
              scenario: SCENARIO,
              draftId,
              userId,
              platform: draft.platform,
              draftType: currentDraft.type,
              contextSource,
            },
          });

          await pumpAgentEvents(debugLogger.streamEvents(eventStream), emitter, {
            scenario: SCENARIO,
            meta: { draftId },
            extractResult: extractCreateToolResult,
          });
        });

        emitter.enqueue('done', {});
        controller.close();
      } catch (error) {
        console.error('[create-agent] 运行失败:', error);
        const msg = error instanceof Error ? error.message : '未知错误';
        emitter.enqueue('error', { message: msg });
        controller.close();
      }
    },
  });
}
