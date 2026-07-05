import { prisma } from '@/lib/prisma';
import { getAIConfig } from '@/lib/ai-config';
import type { Prisma } from '@/generated/prisma-client/client';
import type { MessageMetadata, MessageMetadataStep } from '@/services/chat-log';

export interface AiLabRunQuery {
  pageNum?: number;
  pageSize?: number;
  source?: string;
  userId?: number;
  deviceId?: string;
  keyword?: string;
  model?: string;
  toolName?: string;
  hasTool?: boolean;
  hasError?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface CreateChatRunParams {
  sessionId: number;
  messageId: number;
  userId?: number | null;
  deviceId?: string | null;
  question: string;
  answer: string;
  metadata?: MessageMetadata | null;
  latencyMs?: number;
  styleVariant?: string;
}

interface AiLabToolCall {
  name: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  inputSummary?: string;
  outputSummary?: string;
  success: boolean;
}

function extractToolCalls(metadata?: MessageMetadata | null): AiLabToolCall[] {
  const loops = metadata?.reactLoops ?? [];

  return loops.flatMap((loop) => {
      const action = loop.steps.find((step) => step.type === 'action');
      const observation = loop.steps.find((step) => step.type === 'observation');
      const toolName = action?.toolName || observation?.toolName;

      if (!toolName) return [];

      const call: AiLabToolCall = {
        name: toolName,
        success: !isErrorStep(observation),
      };
      const startedAt = action?.startedAt || observation?.startedAt;
      const endedAt = observation?.endedAt || action?.endedAt;
      const durationMs = observation?.durationMs ?? action?.durationMs;

      if (startedAt) call.startedAt = startedAt;
      if (endedAt) call.endedAt = endedAt;
      if (typeof durationMs === 'number') call.durationMs = durationMs;
      if (action?.content) call.inputSummary = action.content;
      if (observation?.content) call.outputSummary = observation.content;

      return [call];
    });
}

function isErrorStep(step?: MessageMetadataStep) {
  if (!step?.content) return false;
  return /失败|错误|异常|error|timeout/i.test(step.content);
}

function getMaxToolDuration(toolCalls: AiLabToolCall[]) {
  const durations = toolCalls
    .map((call) => call.durationMs)
    .filter((duration): duration is number => typeof duration === 'number');

  return durations.length > 0 ? Math.max(...durations) : undefined;
}

function getCommitSha() {
  return process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.NEXT_PUBLIC_COMMIT_SHA
    || process.env.GIT_COMMIT_SHA
    || undefined;
}

async function getModelSnapshot() {
  const snapshot: {
    model?: string;
    embeddingModel?: string;
  } = {};

  try {
    snapshot.model = (await getAIConfig('chat')).model;
  } catch (error) {
    console.warn('读取 chat 模型配置失败，AI Lab Run 将不记录 model:', error);
  }

  try {
    snapshot.embeddingModel = (await getAIConfig('embedding')).model;
  } catch {
    // 非检索问题也会写 Run，embedding 配置缺失不应影响聊天记录。
  }

  return snapshot;
}

export async function createAiLabRunFromChat(params: CreateChatRunParams) {
  const existing = await prisma.tbAiLabRun.findFirst({
    where: {
      source: 'chat',
      message_id: params.messageId,
    },
    select: { id: true },
  });

  if (existing) return existing;

  const toolCalls = extractToolCalls(params.metadata);
  const toolErrorCount = toolCalls.filter((call) => !call.success).length;
  const firstToolName = toolCalls[0]?.name;
  const usesRetrieval = toolCalls.some((call) => call.name === 'search_articles');
  const modelSnapshot = await getModelSnapshot();

  return prisma.tbAiLabRun.create({
    data: {
      source: 'chat',
      session_id: params.sessionId,
      message_id: params.messageId,
      user_id: params.userId ?? null,
      device_id: params.deviceId ?? null,
      question: params.question,
      answer: params.answer,
      scenario: 'chat',
      style_variant: params.styleVariant,
      model: modelSnapshot.model,
      embedding_model: modelSnapshot.embeddingModel,
      prompt_version: 'chat-agent-current',
      retriever_version: usesRetrieval ? 'dense-qdrant-current' : null,
      commit_sha: getCommitSha(),
      latency_ms: params.latencyMs,
      tool_call_count: toolCalls.length,
      tool_error_count: toolErrorCount,
      max_tool_duration_ms: getMaxToolDuration(toolCalls),
      first_tool_name: firstToolName,
      tool_calls: toolCalls.length > 0 ? toolCalls as unknown as Prisma.InputJsonValue : undefined,
      metadata: params.metadata ? params.metadata as unknown as Prisma.InputJsonValue : undefined,
    },
  });
}

function buildRunWhere(params: AiLabRunQuery): Prisma.TbAiLabRunWhereInput {
  const and: Prisma.TbAiLabRunWhereInput[] = [];

  if (params.source) {
    and.push({ source: params.source });
  }
  if (params.userId) {
    and.push({ user_id: params.userId });
  }
  if (params.deviceId) {
    and.push({ device_id: { contains: params.deviceId } });
  }
  if (params.model) {
    and.push({ model: { contains: params.model } });
  }
  if (params.toolName) {
    and.push({ first_tool_name: params.toolName });
  }
  if (params.hasTool !== undefined) {
    and.push({ tool_call_count: params.hasTool ? { gt: 0 } : 0 });
  }
  if (params.hasError !== undefined) {
    and.push(params.hasError
      ? {
          OR: [
            { error: { not: null } },
            { tool_error_count: { gt: 0 } },
          ],
        }
      : {
          error: null,
          tool_error_count: 0,
        });
  }
  if (params.keyword) {
    and.push({
      OR: [
        { question: { contains: params.keyword } },
        { answer: { contains: params.keyword } },
        { model: { contains: params.keyword } },
        { first_tool_name: { contains: params.keyword } },
        { user: { nickname: { contains: params.keyword } } },
        { user: { account: { contains: params.keyword } } },
      ],
    });
  }
  if (params.startDate || params.endDate) {
    const end = params.endDate ? new Date(params.endDate) : undefined;
    if (end) {
      end.setHours(23, 59, 59, 999);
    }

    and.push({
      created_at: {
        ...(params.startDate ? { gte: new Date(params.startDate) } : {}),
        ...(end ? { lte: end } : {}),
      },
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

export async function getAiLabRuns(params: AiLabRunQuery) {
  const {
    pageNum = 1,
    pageSize = 20,
  } = params;
  const take = Math.min(Math.max(pageSize, 1), 100);
  const where = buildRunWhere(params);

  const [records, total, latencyStats, errorCount, toolRunCount] = await Promise.all([
    prisma.tbAiLabRun.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (pageNum - 1) * take,
      take,
      include: {
        user: {
          select: { id: true, nickname: true, account: true },
        },
      },
    }),
    prisma.tbAiLabRun.count({ where }),
    prisma.tbAiLabRun.aggregate({
      where,
      _avg: { latency_ms: true },
      _max: { latency_ms: true },
    }),
    prisma.tbAiLabRun.count({
      where: {
        AND: [
          where,
          {
            OR: [
              { error: { not: null } },
              { tool_error_count: { gt: 0 } },
            ],
          },
        ],
      },
    }),
    prisma.tbAiLabRun.count({
      where: {
        AND: [
          where,
          { tool_call_count: { gt: 0 } },
        ],
      },
    }),
  ]);

  return {
    record: records,
    total,
    pageNum,
    pageSize: take,
    stats: {
      avgLatencyMs: latencyStats._avg.latency_ms,
      maxLatencyMs: latencyStats._max.latency_ms,
      errorCount,
      toolRunCount,
    },
  };
}

export async function getAiLabRunDetail(id: number) {
  return prisma.tbAiLabRun.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, nickname: true, account: true },
      },
      session: {
        select: {
          id: true,
          title: true,
          message_count: true,
          created_at: true,
          updated_at: true,
        },
      },
      message: {
        select: {
          id: true,
          role: true,
          content: true,
          metadata: true,
          created_at: true,
        },
      },
    },
  });
}

export async function updateAiLabRunFeedback(params: {
  id: number;
  feedback?: string | null;
  feedbackNote?: string | null;
}) {
  return prisma.tbAiLabRun.update({
    where: { id: params.id },
    data: {
      feedback: params.feedback ?? null,
      feedback_note: params.feedbackNote ?? null,
    },
  });
}
