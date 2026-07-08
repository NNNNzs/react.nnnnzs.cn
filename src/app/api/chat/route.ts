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
import { createSSEResponse } from '@/lib/sse';
import {
  createSession,
  createMessage,
  getSessionDetail,
  touchSession,
  updateSessionTitle,
} from '@/services/chat-log';
import { errorResponse } from '@/dto/response.dto';
import type { ApiDescriptor } from '@/types/api-descriptor';
import type { StoredReactStep, StoredReactTimelineItem } from '@/types/agent-stream';
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

    // 调用 Chat Agent 服务（流式响应，SSE 事件流）
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

    // 用 TransformStream 包装：透传 SSE 帧给客户端，同时解析收集用于落库
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    // 收集 AI 回复的各部分内容
    const collectedThoughts: string[] = [];
    const collectedSteps: Array<StoredReactStep & { index: number }> = [];
    const collectedTimeline: StoredReactTimelineItem[] = [];
    let collectedContent = '';
    let currentThinkContent = '';

    // 简易 SSE 帧解析器（服务端用，处理 Uint8Array 流）
    const sseBuffer = new TextDecoder();
    let sseRaw = '';

    const processSSEBuffer = () => {
      let sepIndex: number;
      while ((sepIndex = sseRaw.indexOf('\n\n')) !== -1) {
        const rawFrame = sseRaw.slice(0, sepIndex);
        sseRaw = sseRaw.slice(sepIndex + 2);
        parseSSEFrameServer(rawFrame);
      }
    };

    const parseSSEFrameServer = (raw: string) => {
      const lines = raw.split('\n');
      let eventName = 'message';
      const dataLines: string[] = [];

      for (const line of lines) {
        if (!line || line.startsWith(':')) continue;
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).replace(/^ /, ''));
        }
      }

      if (dataLines.length === 0) return;

      const dataStr = dataLines.join('\n');
      let data: unknown;
      try {
        data = JSON.parse(dataStr);
      } catch {
        return;
      }

      switch (eventName) {
        case 'think_chunk': {
          const { content } = data as { content: string };
          currentThinkContent += content;
          break;
        }
        case 'think_start': {
          currentThinkContent = '';
          collectedThoughts.push('');
          collectedTimeline.push({ type: 'think', content: '' });
          break;
        }
        case 'think_end': {
          if (currentThinkContent) {
            const thoughtIdx = collectedThoughts.length - 1;
            if (thoughtIdx >= 0) {
              collectedThoughts[thoughtIdx] = currentThinkContent;
            }
            const lastTimeline = collectedTimeline[collectedTimeline.length - 1];
            if (lastTimeline && lastTimeline.type === 'think') {
              lastTimeline.content = currentThinkContent;
            }
          }
          currentThinkContent = '';
          break;
        }
        case 'tool_start': {
          const { tool, args, step } = data as {
            tool: string;
            args?: unknown;
            step: number;
            runId: string;
          };
          const stepContent = `${tool}(${typeof args === 'string' ? args : JSON.stringify(args)})`;
          collectedSteps.push({
            type: 'action',
            content: stepContent,
            index: step,
            toolName: tool,
            startedAt: new Date().toISOString(),
          });
          const existing = collectedTimeline.find(
            (item): item is StoredReactTimelineItem & { type: 'loop' } =>
              item.type === 'loop' && item.index === step,
          );
          if (existing) {
            existing.steps.push({
              type: 'action',
              content: stepContent,
              index: step,
              toolName: tool,
              startedAt: new Date().toISOString(),
            });
          } else {
            collectedTimeline.push({
              type: 'loop',
              index: step,
              steps: [{
                type: 'action',
                content: stepContent,
                index: step,
                toolName: tool,
                startedAt: new Date().toISOString(),
              }],
            });
          }
          break;
        }
        case 'tool_end': {
          const { result, step } = data as {
            tool: string;
            result?: string;
            step: number;
            runId: string;
          };
          const stepRecord = collectedSteps.find(
            (s) => s.index === step && s.type === 'action',
          );
          if (stepRecord) {
            stepRecord.type = 'observation';
            stepRecord.content = result || '';
            stepRecord.endedAt = new Date().toISOString();
            if (stepRecord.startedAt) {
              stepRecord.durationMs =
                new Date(stepRecord.endedAt).getTime() -
                new Date(stepRecord.startedAt).getTime();
            }
          }
          const loopItem = collectedTimeline.find(
            (item): item is StoredReactTimelineItem & { type: 'loop' } =>
              item.type === 'loop' && item.index === step,
          );
          if (loopItem) {
            const actionStep = loopItem.steps.find((s) => s.type === 'action' && !s.endedAt);
            if (actionStep) {
              actionStep.type = 'observation';
              actionStep.content = result || '';
              actionStep.endedAt = stepRecord?.endedAt;
              if (typeof stepRecord?.durationMs === 'number') {
                actionStep.durationMs = stepRecord.durationMs;
              }
            }
          }
          break;
        }
        case 'content_chunk':
        case 'token': {
          const { content: chunk } = data as { content: string };
          collectedContent += chunk;
          break;
        }
      }
    };

    // 将原始流的数据泵入 writer，同时解析 SSE 帧收集内容
    const pumpAndCollect = async () => {
      const reader = originalStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;

          // 透传给客户端
          await writer.write(value);

          // 解析 SSE 帧收集内容
          sseRaw += sseBuffer.decode(value, { stream: true });
          processSSEBuffer();
        }

        // 处理残留 buffer
        sseRaw += sseBuffer.decode();
        if (sseRaw.trim()) processSSEBuffer();
      } catch (err) {
        console.error('Stream pump error:', err);
      } finally {
        await writer.close();

        // 异步存储 AI 回复（不阻塞响应）
        if (collectedContent) {
          const reactLoopsMap = new Map<number, StoredReactStep[]>();
          for (const step of collectedSteps) {
            const existing = reactLoopsMap.get(step.index) || [];
            existing.push(step);
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
    return createSSEResponse(readable, {
      'X-Session-Id': String(activeSessionId),
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
