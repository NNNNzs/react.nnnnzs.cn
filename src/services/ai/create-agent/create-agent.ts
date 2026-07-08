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
import {
  createSseEmitter,
  pumpAgentEvents,
  getRecord,
} from '@/services/ai/agent-stream';

export interface CreateAgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CreateAgentStreamParams {
  draftId: number;
  userId: number;
  message: string;
  history?: CreateAgentMessage[];
}

const SCENARIO = 'create_agent';

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
  const { draftId, userId, message, history = [] } = params;

  if (!message?.trim()) {
    throw new Error('消息内容不能为空');
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emitter = createSseEmitter(controller, 'create-agent');

      // emitPatch：把草稿 patch 作为 patch 帧推到当前流
      // （事件名统一为 patch，前端 useAgentStream 监听 patch）
      const emitPatch = (patch: DraftPatch) => {
        emitter.enqueue('patch', patch);
      };

      try {
        // 预读草稿，填充 system prompt 占位符
        const draft = await getContentDraft(draftId);
        const systemPrompt = await buildCreateAgentSystemPrompt({
          draftTitle: draft?.title ?? '',
          draftType: draft?.type ?? 'note',
        });

        const model = await createOpenAIModel({ scenario: SCENARIO });
        const tools = buildCreateTools({ draftId, userId, emitPatch });

        const agent = createReactAgent({
          llm: model.bindTools(tools),
          tools,
          prompt: systemPrompt,
        });

        const messages = buildMessages(message, history);
        const eventStream = agent.streamEvents({ messages }, { version: 'v2' });

        await pumpAgentEvents(eventStream, emitter, {
          scenario: SCENARIO,
          meta: { draftId },
          extractResult: extractCreateToolResult,
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
