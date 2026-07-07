/**
 * 创作助手 Agent（SSE 版）
 *
 * 基于 LangGraph createReactAgent，输出标准 SSE 多事件流（src/lib/sse.ts）。
 * 与 chat-agent（XML 标签协议）独立，互不影响。
 *
 * 工具集按请求构建（buildCreateTools），注入 draftId/userId/emitPatch。
 * emit_draft_patch 工具触发时，patch 通过 emitPatch 推送为 SSE draft_patch 帧。
 */

import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { createOpenAIModel } from '@/lib/ai';
import { encodeSSE } from '@/lib/sse';
import { getContentDraft } from '@/services/content-creation';
import { buildCreateAgentSystemPrompt } from './prompt';
import { buildCreateTools } from '../tools/create-tools/langchain-tools';
import type { DraftPatch } from '../tools/create-tools/draft-patch';

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

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
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
      // 流可能因客户端断开而进入 closed/errored 态，此时 enqueue 会抛 TypeError。
      // 用 desiredSize 判断 + try/catch 兜底，避免异常逸出 start()。
      const isWritable = () => controller.desiredSize !== null;
      const enqueue = (event: string, data: unknown) => {
        if (!isWritable()) return;
        try {
          controller.enqueue(new TextEncoder().encode(encodeSSE(event, data)));
        } catch (err) {
          console.warn('[create-agent] enqueue 失败（流已关闭）:', err);
        }
      };

      // emitPatch：把 draft_patch 帧直接推到当前流
      const emitPatch = (patch: DraftPatch) => {
        enqueue('draft_patch', patch);
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

        enqueue('meta', { scenario: SCENARIO, draftId });

        const messages = buildMessages(message, history);
        const toolStartByRunId = new Map<string, number>();
        let stepIndex = 0;

        const eventStream = agent.streamEvents({ messages }, { version: 'v2' });

        for await (const event of eventStream) {
          const { event: eventType, data } = event;
          const eventRecord = event as Record<string, unknown>;
          const runId = asString(eventRecord.run_id);

          if (eventType === 'on_chat_model_stream') {
            const chunk = (data as { chunk?: unknown })?.chunk;
            if (!chunk) continue;
            const chunkRecord = chunk as Record<string, unknown> | undefined;
            const contentRecord = chunkRecord?.content;
            const content =
              typeof contentRecord === 'string'
                ? contentRecord
                : Array.isArray(contentRecord)
                  ? contentRecord
                      .map((p) => {
                        const r = p as Record<string, unknown>;
                        return typeof r?.text === 'string' ? r.text : '';
                      })
                      .join('')
                  : '';
            if (content) {
              enqueue('token', { content });
            }
          }

          if (eventType === 'on_tool_start') {
            stepIndex++;
            toolStartByRunId.set(runId, stepIndex);
            const toolName = asString(eventRecord.name);
            const input = (data as { input?: unknown })?.input ?? {};
            enqueue('tool_start', {
              tool: toolName,
              args: input,
              runId,
              step: stepIndex,
            });
          }

          if (eventType === 'on_tool_end') {
            const step = toolStartByRunId.get(runId) ?? stepIndex;
            const output = (data as { output?: unknown })?.output;
            const outputText =
              typeof output === 'string' ? output : JSON.stringify(output);
            enqueue('tool_end', {
              tool: asString(eventRecord.name),
              result: truncate(outputText),
              runId,
              step,
            });
          }
        }

        enqueue('done', {});
        controller.close();
      } catch (error) {
        console.error('[create-agent] 运行失败:', error);
        const msg = error instanceof Error ? error.message : '未知错误';
        enqueue('error', { message: msg });
        controller.close();
      }
    },
  });
}

/** 工具结果截断，避免超长 output 塞爆 SSE 帧 */
function truncate(text: string, max = 2000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…（已截断，共 ${text.length} 字符）`;
}
