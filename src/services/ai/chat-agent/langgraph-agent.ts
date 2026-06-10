/**
 * LangGraph Chat Agent 实现。
 * Agent 负责统一编排工具调用；RAG/向量检索是 tools 层的一种能力。
 */

import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { createOpenAIModel } from '@/lib/ai';
import { StreamTagGenerator } from '@/lib/stream-tags';
import { chatTools } from '@/services/ai/tools/langchain-tools';
import { buildChatAgentSystemPrompt } from './prompt';

export interface ChatAgentParams {
  question: string;
  userInfo: string;
  siteName: string;
  currentTime: string;
  baseUrl: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  scenario?: 'chat' | 'ai_text';
}

type Phase = 'init' | 'answering';

interface ToolCallChunk {
  name?: string;
  args?: Record<string, unknown>;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function getStringField(source: unknown, key: string): string {
  const record = getRecord(source);
  const value = record?.[key];
  return typeof value === 'string' ? value : '';
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      const record = getRecord(part);
      if (!record) return '';
      if (typeof record.text === 'string') return record.text;
      return '';
    })
    .join('');
}

/**
 * DeepSeek OpenAI-compatible streaming chunks expose reasoning tokens in
 * provider-specific metadata. LangChain preserves these fields in different
 * places depending on adapter/version, so we check the common shapes.
 */
function extractReasoningContent(chunk: unknown): string {
  const record = getRecord(chunk);
  if (!record) return '';

  const direct = getStringField(record, 'reasoning_content')
    || getStringField(record, 'reasoning');
  if (direct) return direct;

  const additionalKwargs = getRecord(record.additional_kwargs);
  const fromAdditional = getStringField(additionalKwargs, 'reasoning_content')
    || getStringField(additionalKwargs, 'reasoning');
  if (fromAdditional) return fromAdditional;

  const responseMetadata = getRecord(record.response_metadata);
  const fromMetadata = getStringField(responseMetadata, 'reasoning_content')
    || getStringField(responseMetadata, 'reasoning');
  if (fromMetadata) return fromMetadata;

  const kwargs = getRecord(record.lc_kwargs);
  const kwargsAdditional = getRecord(kwargs?.additional_kwargs);
  return getStringField(kwargsAdditional, 'reasoning_content')
    || getStringField(kwargsAdditional, 'reasoning');
}

function extractObservationText(data: unknown): string {
  const event = getRecord(data);
  if (!event) return '';

  const output = getRecord(event.output);
  if (!output) return '';

  const kw = getRecord(output.lc_kwargs) || output;
  const content = getStringField(kw, 'content');
  if (!content) return '';

  try {
    const parsed = JSON.parse(content);

    if (Array.isArray(parsed.results) && parsed.results.length > 0) {
      const total = parsed.totalResults || parsed.results.length;
      const titles = parsed.results
        .slice(0, 5)
        .map((r: { title?: string }, i: number) => `${i + 1}. ${r.title || '未知文章'}`)
        .join('\n');
      return `找到 ${total} 篇相关文章：\n${titles}`;
    }

    if (parsed.results && typeof parsed.total === 'number') {
      return `${parsed.message || `找到 ${parsed.total} 篇文章`}`;
    }

    if (parsed.message) return parsed.message;
    return content.slice(0, 200);
  } catch {
    return content.slice(0, 200);
  }
}

function extractToolCallInfo(toolCalls: ToolCallChunk[]): string {
  if (toolCalls.length === 0) return '';

  const tc = toolCalls[0];
  const name = tc.name || 'unknown';
  const args = tc.args || {};

  if (name === 'search_articles') {
    return `搜索文章：${args.query || ''}（共 ${args.limit || 5} 篇）`;
  }
  if (name === 'search_posts_meta') {
    return `查询文章列表（${args.sort_by || 'date'} ${args.sort_order || 'desc'}）`;
  }
  if (name === 'search_collection') {
    return `搜索合集：${args.collection || ''}`;
  }

  return `${name}(${JSON.stringify(args).slice(0, 80)})`;
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
): Promise<ReadableStream> => {
  const { question, history = [], scenario = 'chat' } = params;

  if (!question || question.trim().length === 0) {
    throw new Error('问题内容不能为空');
  }

  const tagGenerator = new StreamTagGenerator();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let inThinkTag = false;
      let inContentTag = false;

      try {
        const systemPrompt = await buildChatAgentSystemPrompt(params);
        const model = await createOpenAIModel({ scenario });

        const agent = createReactAgent({
          llm: model.bindTools(chatTools),
          tools: chatTools,
          prompt: systemPrompt,
        });

        const messages = buildMessages(question, history);
        let stepIndex = 0;
        let hasToolExecuted = false;
        let phase: Phase = 'init';

        const eventStream = agent.streamEvents(
          { messages },
          { version: 'v2' },
        );

        for await (const event of eventStream) {
          const { event: eventType, data } = event;

          if (eventType === 'on_chat_model_stream') {
            const chunk = data?.chunk;
            if (!chunk) continue;

            const reasoningContent = extractReasoningContent(chunk);
            if (reasoningContent) {
              if (!inThinkTag) {
                controller.enqueue(tagGenerator.startThink());
                inThinkTag = true;
              }
              controller.enqueue(encoder.encode(reasoningContent));
            }

            const chunkRecord = getRecord(chunk);
            const toolCalls = (chunkRecord?.tool_calls || []) as ToolCallChunk[];
            if (toolCalls.length > 0) {
              if (inThinkTag) {
                controller.enqueue(tagGenerator.endThink());
                inThinkTag = false;
              }
              if (inContentTag) {
                controller.enqueue(tagGenerator.endContent());
                inContentTag = false;
              }

              stepIndex++;
              controller.enqueue(
                tagGenerator.generateStep('action', stepIndex, extractToolCallInfo(toolCalls)),
              );

              phase = 'init';
              hasToolExecuted = true;
              continue;
            }

            const content = extractTextContent(chunkRecord?.content);
            if (content) {
              if (inThinkTag) {
                controller.enqueue(tagGenerator.endThink());
                inThinkTag = false;
              }

              if (hasToolExecuted && phase !== 'answering') {
                phase = 'answering';
                if (!inContentTag) {
                  controller.enqueue(tagGenerator.startContent());
                  inContentTag = true;
                }
              } else if (!hasToolExecuted && !inContentTag) {
                controller.enqueue(tagGenerator.startContent());
                inContentTag = true;
              }

              controller.enqueue(encoder.encode(content));
            }
          }

          if (eventType === 'on_tool_end') {
            if (inThinkTag) {
              controller.enqueue(tagGenerator.endThink());
              inThinkTag = false;
            }

            controller.enqueue(
              tagGenerator.generateStep('observation', stepIndex, extractObservationText(data)),
            );
          }
        }

        if (inThinkTag) {
          controller.enqueue(tagGenerator.endThink());
        }
        if (inContentTag) {
          controller.enqueue(tagGenerator.endContent());
        }

        controller.close();
      } catch (error) {
        console.error('Chat Agent 运行失败:', error);

        if (inThinkTag) {
          controller.enqueue(tagGenerator.endThink());
        }
        if (inContentTag) {
          controller.enqueue(tagGenerator.endContent());
        }

        const errorMsg = error instanceof Error ? error.message : '未知错误';
        controller.enqueue(tagGenerator.generateThink(`处理出错：${errorMsg}`));
        controller.error(error);
      }
    },
  });
};

/**
 * @deprecated 请使用 chatAgentStream。保留旧名称是为了兼容迁移期调用方。
 */
export const chatRAGAgentStream = chatAgentStream;

/**
 * @deprecated 请使用 ChatAgentParams。保留旧类型名是为了兼容迁移期调用方。
 */
export type RAGAgentParams = ChatAgentParams;
