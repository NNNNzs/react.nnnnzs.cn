/**
 * 聊天 API 路由
 * POST /api/chat
 * 使用 Chat Agent 编排工具调用和 SSE 流式响应
 * 流式完成后异步存储聊天记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl, getUserFromToken } from '@/lib/auth';
import dayjs from 'dayjs';

/**
 * 从请求中获取客户端 IP
 */
function getClientIp(request: NextRequest): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || undefined;
}
import { chatAgentStream } from '@/services/ai/chat-agent';
import { createStreamResponse } from '@/lib/stream';
import {
  createSession,
  createMessage,
  getSessionDetail,
  touchSession,
  updateSessionTitle,
} from '@/services/chat-log';
import { StreamTagParser, type StreamStepMeta, type StreamTag } from '@/lib/stream-tags';
import { errorResponse } from '@/dto/response.dto';
import type { ApiDescriptor } from '@/types/api-descriptor';
import type { StepType } from '@/lib/stream-tags';
import { generateChatSessionTitle } from '@/services/ai/chat-agent/title';
import { parseSiteStyleVariant } from '@/lib/site-style/variant';
import type { SiteStyleVariant } from '@/lib/site-style/variant';
import { createAiLabRunFromChat } from '@/services/ai-lab-run';

/** 接口自描述信息 */
export const descriptor: ApiDescriptor = {
  code: 'chat_send',
  name: '发送聊天消息',
  description: '与 AI 聊天机器人对话，由 Chat Agent 按需检索博客内容并回答问题',
  module: 'chat',
  method: 'POST',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: '用户消息' },
      history: {
        type: 'array',
        description: '历史消息记录',
        items: {
          type: 'object',
          properties: {
            role: { type: 'string', description: '角色：user 或 assistant' },
            content: { type: 'string', description: '消息内容' },
          },
        },
      },
      sessionId: { type: 'number', description: '会话ID（可选，不传则自动创建）' },
      styleVariant: {
        type: 'string',
        description: '站点风格语义：day（日间文艺）或 night（夜间赛博朋克）',
      },
    },
    required: ['message'],
  },
};

/**
 * 请求体类型定义
 */
interface ChatRequest {
  message: string;
  history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  sessionId?: number;
  styleVariant?: SiteStyleVariant;
}

type StoredReactStep = {
  type: StepType;
  content: string;
  toolName?: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
};

type StoredReactTimelineItem =
  | {
      type: 'think';
      content: string;
    }
  | {
      type: 'loop';
      index: number;
      steps: StoredReactStep[];
    };

/**
 * 聊天 API
 * POST /api/chat
 * 使用简单 RAG 和 SSE 流式响应
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history, sessionId } = body as ChatRequest;
    const styleVariant = parseSiteStyleVariant((body as ChatRequest).styleVariant);

    // 参数验证
    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { status: false, message: '消息内容不能为空' },
        { status: 400 },
      );
    }

    // 获取通用信息
    const baseUrl = getBaseUrl(request);
    const user = await getUserFromToken(request);
    const currentTime = dayjs().format('YYYY年MM月DD日 HH:mm:ss');
    const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'NNNNzs';
    const ipAddress = getClientIp(request);
    const deviceId = user ? undefined : request.headers.get('X-Device-Id') || undefined;
    let shouldGenerateSessionTitle = false;

    // 构建用户信息
    const userInfo = user
      ? `用户已登录，昵称：${user.nickname || user.account}${user.role ? `（${user.role}）` : ''}`
      : '用户未登录（游客模式）';

    // 确定或创建会话
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const session = await createSession({
        userId: user?.id,
        deviceId,
        title: null,
        ipAddress,
        userAgent: request.headers.get('User-Agent') || undefined,
      });
      activeSessionId = session.id;
      shouldGenerateSessionTitle = true;
    } else {
      const session = await getSessionDetail({
        sessionId: activeSessionId,
        userId: user?.id,
        deviceId,
      });

      if (!session) {
        return NextResponse.json(errorResponse('会话不存在或无权访问'), { status: 404 });
      }

      shouldGenerateSessionTitle = !session.title && session.message_count <= 1;
    }

    // 保存用户消息
    await createMessage({
      sessionId: activeSessionId,
      role: 'user',
      content: message,
    });
    await touchSession(activeSessionId, { increment: 1 });

    // 调用 Chat Agent 服务（流式响应，ReAct 范式）
    const runStartedAt = Date.now();
    const originalStream = await chatAgentStream({
      question: message,
      userInfo,
      siteName,
      currentTime,
      baseUrl,
      history: history || [],
      styleVariant,
    });

    // 用 TransformStream 包装，收集流式内容用于存储
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    // 收集 AI 回复的各部分内容
    const collectedThoughts: string[] = [];
    const collectedSteps: Array<StoredReactStep & { index: number }> = [];
    const collectedTimeline: StoredReactTimelineItem[] = [];
    let collectedContent = '';
    const parser = new StreamTagParser();

    const appendThink = (content: string) => {
      const lastTimelineItem = collectedTimeline[collectedTimeline.length - 1];
      if (lastTimelineItem?.type === 'think') {
        const lastThoughtIndex = collectedThoughts.length - 1;
        if (lastThoughtIndex >= 0) {
          collectedThoughts[lastThoughtIndex] += content;
        } else {
          collectedThoughts.push(content);
        }
        lastTimelineItem.content += content;
      } else {
        collectedThoughts.push(content);
        collectedTimeline.push({
          type: 'think',
          content,
        });
      }
    };

    const appendStep = (
      type: StepType,
      content: string,
      index: number,
      meta: StreamStepMeta = {},
    ) => {
      const step: StoredReactStep & { index: number } = {
        type,
        content,
        index,
        ...(meta.toolName ? { toolName: meta.toolName } : {}),
        ...(meta.startedAt ? { startedAt: meta.startedAt } : {}),
        ...(meta.endedAt ? { endedAt: meta.endedAt } : {}),
        ...(typeof meta.durationMs === 'number' ? { durationMs: meta.durationMs } : {}),
      };

      collectedSteps.push(step);
      const { index: _stepIndex, ...storedStep } = step;
      void _stepIndex;

      const existingTimelineItem = collectedTimeline.find(
        (item): item is Extract<StoredReactTimelineItem, { type: 'loop' }> =>
          item.type === 'loop' && item.index === index,
      );
      if (existingTimelineItem) {
        existingTimelineItem.steps.push(storedStep);
        return;
      }

      collectedTimeline.push({
        type: 'loop',
        index,
        steps: [storedStep],
      });
    };

    // 将原始流的数据泵入 writer，同时用 parser 收集内容
    const pumpAndCollect = async () => {
      const reader = originalStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;

          // 传给客户端
          await writer.write(value);

          // 用 parser 收集内容
          parser.parseChunk(value, (tag: StreamTag) => {
            if (tag.type === 'think') {
              appendThink(tag.content);
            } else if (tag.type === 'step' && tag.stepType && tag.stepIndex) {
              appendStep(tag.stepType, tag.content, tag.stepIndex, tag);
            } else if (tag.type === 'content') {
              collectedContent += tag.content;
            }
          });
        }

        // 处理 parser 缓冲区剩余内容
        parser.finish((tag: StreamTag) => {
          if (tag.type === 'think') {
            appendThink(tag.content);
          } else if (tag.type === 'step' && tag.stepType && tag.stepIndex) {
            appendStep(tag.stepType, tag.content, tag.stepIndex, tag);
          } else if (tag.type === 'content') {
            collectedContent += tag.content;
          }
        });
      } catch (err) {
        console.error('Stream pump error:', err);
      } finally {
        await writer.close();

        // 异步存储 AI 回复（不阻塞响应）
        if (collectedContent) {
          // 按 index 分组 steps 为 reactLoops
          const reactLoopsMap = new Map<number, StoredReactStep[]>();
          for (const step of collectedSteps) {
            const existing = reactLoopsMap.get(step.index) || [];
            const { index, ...storedStep } = step;
            void index;
            existing.push(storedStep);
            reactLoopsMap.set(step.index, existing);
          }
          const reactLoops = Array.from(reactLoopsMap.entries()).map(([index, steps]) => ({
            index,
            steps,
          }));

          const assistantMetadata = {
            thoughts: collectedThoughts.length > 0 ? collectedThoughts : undefined,
            reactLoops: reactLoops.length > 0 ? reactLoops : undefined,
            reactTimeline: collectedTimeline.length > 0 ? collectedTimeline : undefined,
          };

          createMessage({
            sessionId: activeSessionId!,
            role: 'assistant',
            content: collectedContent,
            metadata: assistantMetadata,
          })
            .then(async (assistantMessage) => {
              try {
                await createAiLabRunFromChat({
                  sessionId: activeSessionId!,
                  messageId: assistantMessage.id,
                  userId: user?.id,
                  deviceId,
                  question: message,
                  answer: collectedContent,
                  metadata: assistantMetadata,
                  latencyMs: Date.now() - runStartedAt,
                  styleVariant,
                });
              } catch (runError) {
                console.error('写入 AI Lab Run 失败:', runError);
              }

              await touchSession(activeSessionId!, { increment: 1 });

              if (!shouldGenerateSessionTitle) return;

              try {
                const generatedTitle = await generateChatSessionTitle({
                  userMessage: message,
                  assistantMessage: collectedContent,
                });

                if (generatedTitle) {
                  await updateSessionTitle(activeSessionId!, generatedTitle);
                }
              } catch (titleError) {
                console.error('生成会话标题失败:', titleError);
              }
            })
            .catch((err) => {
              console.error('异步存储 AI 回复失败:', err);
            });
        }
      }
    };

    // 异步启动 pump（不 await，让响应立即返回）
    pumpAndCollect();

    // 在响应头中携带 sessionId，前端可用于后续请求
    return createStreamResponse(readable, {
      additionalHeaders: {
        'X-Session-Id': String(activeSessionId),
      },
    });
  } catch (error) {
    console.error('聊天 API 错误:', error);
    return NextResponse.json(
      {
        status: false,
        message: error instanceof Error ? error.message : '服务器内部错误',
      },
      { status: 500 },
    );
  }
}

/**
 * GET Handler - 健康检查
 */
export async function GET() {
  return NextResponse.json({
    status: true,
    message: '聊天 API 正常运行（Chat Agent 模式，RAG 作为工具按需调用）',
  });
}
