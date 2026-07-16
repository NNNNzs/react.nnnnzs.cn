/**
 * LangGraph Chat Agent 实现。
 * Agent 负责统一编排工具调用；RAG/向量检索是 tools 层的一种能力。
 *
 * 流式产出（think / tool / content 帧的解析与 SSE 编码）由共享层
 * src/services/ai/agent-stream 统一处理，与 create-agent 行为一致。
 */

import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { createOpenAIModel } from '@/lib/ai';
import { chatTools } from '@/services/ai/tools/chat-tools';
import { buildChatAgentSystemPrompt } from './prompt';
import {
  createSseEmitter,
  pumpAgentEvents,
} from '@/services/ai/agent-stream';
import { createLangGraphDebugger } from '@/services/ai/langgraph-debugger';
import type { SiteStyleVariant } from '@/lib/site-style/variant';

export interface ChatAgentParams {
  question: string;
  userInfo: string;
  siteName: string;
  currentTime: string;
  baseUrl: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  scenario?: 'chat' | 'ai_text';
  styleVariant?: SiteStyleVariant;
}

function buildMessages(
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Array<HumanMessage | AIMessage> {
  const messages: Array<HumanMessage | AIMessage> = [];

  for (const h of history) {
    messages.push(h.role === 'user' ? new HumanMessage(h.content) : new AIMessage(h.content));
  }
  messages.push(new HumanMessage(question));

  return messages;
}

export const chatAgentStream = async (
  params: ChatAgentParams,
): Promise<ReadableStream<Uint8Array>> => {
  const { question, history = [], scenario = 'chat' } = params;

  if (!question || question.trim().length === 0) {
    throw new Error('问题内容不能为空');
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emitter = createSseEmitter(controller, 'chat-agent');
      const debugLogger = createLangGraphDebugger({
        agentName: 'chat-agent',
        metadata: { scenario, styleVariant: params.styleVariant ?? null },
      });

      try {
        const systemPrompt = await buildChatAgentSystemPrompt(params);
        const model = await createOpenAIModel({ scenario });

        const agent = createReactAgent({
          llm: model.bindTools(chatTools),
          tools: chatTools,
          prompt: systemPrompt,
        });

        const messages = buildMessages(question, history);
        const eventStream = agent.streamEvents({ messages }, {
          version: 'v2',
          runName: 'chat-agent',
          tags: ['agent', 'chat-agent', scenario],
          metadata: { scenario, styleVariant: params.styleVariant ?? null },
        });

        await pumpAgentEvents(debugLogger.streamEvents(eventStream), emitter, { scenario });

        emitter.enqueue('done', {});
        controller.close();
      } catch (error) {
        console.error('Chat Agent 运行失败:', error);

        const errorMsg = error instanceof Error ? error.message : '未知错误';
        emitter.enqueue('think_start', {});
        emitter.enqueue('think_chunk', { content: `处理出错：${errorMsg}` });
        emitter.enqueue('think_end', {});
        emitter.enqueue('content_chunk', { content: `抱歉，这次处理没有完成：${errorMsg}` });
        emitter.enqueue('error', { message: errorMsg });
        controller.close();
      }
    },
  });
};
