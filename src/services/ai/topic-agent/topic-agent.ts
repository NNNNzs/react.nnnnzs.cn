import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { createOpenAIModel } from '@/lib/ai';
import { getContentTopic } from '@/services/content-creation';
import {
  createSseEmitter,
  getRecord,
  pumpAgentEvents,
} from '@/services/ai/agent-stream';
import { buildTopicTools } from '../tools/topic-tools/langchain-tools';
import { buildTopicAgentSystemPrompt } from './prompt';
import type { TopicPatch } from './topic-patch';
import { withPhoenixAgentTrace } from '@/lib/phoenix-observability';
import { createLangGraphDebugger } from '@/services/ai/langgraph-debugger';

export interface TopicAgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TopicAgentStreamParams {
  topicId?: number;
  /** 实际发起请求的用户；与用于工具数据过滤的 scopeUserId 分离。 */
  actorUserId: number;
  scopeUserId?: number;
  message: string;
  history?: TopicAgentMessage[];
}

const SCENARIO = 'topic_agent';

function buildMessages(
  question: string,
  history: TopicAgentMessage[],
): Array<HumanMessage | AIMessage> {
  const messages: Array<HumanMessage | AIMessage> = [];
  for (const item of history) {
    messages.push(item.role === 'user' ? new HumanMessage(item.content) : new AIMessage(item.content));
  }
  messages.push(new HumanMessage(question));
  return messages;
}

function extractTopicToolResult(data: unknown): string {
  const output = getRecord(data)?.output;
  if (!output) return '';
  return typeof output === 'string' ? output : JSON.stringify(output);
}

export async function topicAgentStream(
  params: TopicAgentStreamParams,
): Promise<ReadableStream<Uint8Array>> {
  const {
    topicId,
    actorUserId,
    scopeUserId,
    message,
    history = [],
  } = params;
  if (!message?.trim()) throw new Error('消息内容不能为空');

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emitter = createSseEmitter(controller, 'topic-agent');
      const debugLogger = createLangGraphDebugger({
        agentName: 'topic-agent',
        metadata: { topicId: topicId ?? null, actorUserId, scopeUserId: scopeUserId ?? null },
      });
      const emitPatch = (patch: TopicPatch) => {
        void debugLogger.log('topic_patch', patch);
        emitter.enqueue('patch', patch);
      };

      try {
        const topic = topicId ? await getContentTopic(topicId) : null;
        const topicContext = topic ? JSON.stringify({
          id: topic.id,
          title: topic.title,
          sourceType: topic.source_type,
          sourceUrl: topic.source_url,
          sourcePostId: topic.source_post_id,
          originalIdea: topic.original_idea,
          coreAngle: topic.core_angle,
          keyPoints: topic.key_points,
          status: topic.status,
          draftCount: topic._count.drafts,
        }) : JSON.stringify({ mode: 'create', topic: null });
        const systemPrompt = await buildTopicAgentSystemPrompt({
          topicTitle: topic?.title,
          mode: topic ? 'edit' : 'create',
          runtimeContext: topicContext,
        });

        const model = await createOpenAIModel({ scenario: SCENARIO });
        const tools = buildTopicTools({ topicId, scopeUserId, emitPatch });
        const agent = createReactAgent({
          llm: model.bindTools(tools),
          tools,
          prompt: systemPrompt,
        });
        await withPhoenixAgentTrace({
          name: 'topic-agent',
          userId: actorUserId,
          metadata: {
            scenario: SCENARIO,
            topicId: topicId ?? null,
            mode: topic ? 'edit' : 'create',
            route: topicId ? '/api/create/topics/:id/chat' : '/api/create/topics/chat',
          },
        }, async () => {
          const eventStream = agent.streamEvents({
            messages: buildMessages(message, history),
          }, {
            version: 'v2',
            runName: 'topic-agent',
            tags: ['agent', 'topic-agent', topic ? 'edit' : 'create'],
            metadata: {
              scenario: SCENARIO,
              topicId: topicId ?? null,
              actorUserId,
              mode: topic ? 'edit' : 'create',
            },
          });

          await pumpAgentEvents(debugLogger.streamEvents(eventStream), emitter, {
            scenario: SCENARIO,
            meta: { topicId: topicId ?? null },
            extractResult: extractTopicToolResult,
          });
        });
        emitter.enqueue('done', {});
        controller.close();
      } catch (error) {
        console.error('[topic-agent] 运行失败:', error);
        emitter.enqueue('error', {
          message: error instanceof Error ? error.message : '选题助手运行失败',
        });
        controller.close();
      }
    },
  });
}
