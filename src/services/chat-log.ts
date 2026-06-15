/**
 * 聊天记录 CRUD 服务层
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma-client';

// ============ 类型定义 ============

/** 会话摘要（列表展示用） */
export interface ChatSessionSummary {
  id: number;
  title: string | null;
  message_count: number;
  created_at: Date;
  updated_at: Date;
  user?: {
    id: number;
    nickname: string | null;
    account: string;
  } | null;
  device_id: string | null;
}

/** 消息记录 */
export interface ChatMessageRecord {
  id: number;
  session_id: number;
  role: string;
  content: string;
  metadata: unknown | null;
  created_at: Date;
}

/** 会话详情（含消息列表） */
export interface ChatSessionDetail extends ChatSessionSummary {
  messages: ChatMessageRecord[];
}

// ============ 会话 CRUD ============

/**
 * 创建新会话
 */
export async function createSession(params: {
  userId?: number | null;
  deviceId?: string | null;
  title?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  return prisma.tbChatSession.create({
    data: {
      user_id: params.userId ?? null,
      device_id: params.deviceId ?? null,
      title: params.title ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
    },
  });
}

/**
 * 更新会话标题
 */
export async function updateSessionTitle(id: number, title: string) {
  return prisma.tbChatSession.update({
    where: { id },
    data: { title },
  });
}

/**
 * 更新会话消息计数
 */
export async function incrementSessionMessageCount(id: number, count: number = 1) {
  return prisma.tbChatSession.update({
    where: { id },
    data: {
      message_count: { increment: count },
    },
  });
}

/**
 * 更新会话标题和活跃时间
 */
export async function touchSession(
  id: number,
  params: {
    title?: string | null;
    increment?: number;
  } = {},
) {
  return prisma.tbChatSession.update({
    where: { id },
    data: {
      ...(params.title ? { title: params.title } : {}),
      ...(params.increment ? { message_count: { increment: params.increment } } : {}),
    },
  });
}

/**
 * 获取当前用户的会话列表（登录用户或游客）
 */
export async function getSessions(params: {
  userId?: number | null;
  deviceId?: string | null;
  pageNum?: number;
  pageSize?: number;
}) {
  const { userId, deviceId, pageNum = 1, pageSize = 20 } = params;

  const where: Prisma.TbChatSessionWhereInput = {
    is_delete: 0,
  };

  if (userId) {
    where.user_id = userId;
  } else if (deviceId) {
    where.device_id = deviceId;
  }

  const [records, total] = await Promise.all([
    prisma.tbChatSession.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        message_count: true,
        created_at: true,
        updated_at: true,
        device_id: true,
        user: {
          select: { id: true, nickname: true, account: true },
        },
      },
    }),
    prisma.tbChatSession.count({ where }),
  ]);

  return { record: records, total, pageNum, pageSize };
}

/**
 * 获取单个会话详情（含消息）
 */
export async function getSessionDetail(params: {
  sessionId: number;
  userId?: number | null;
  deviceId?: string | null;
  isAdmin?: boolean;
}) {
  const { sessionId, userId, deviceId, isAdmin } = params;

  const where: Prisma.TbChatSessionWhereInput = {
    id: sessionId,
    is_delete: 0,
  };

  // 非管理员只能看自己的会话
  if (!isAdmin) {
    if (userId) {
      where.user_id = userId;
    } else if (deviceId) {
      where.device_id = deviceId;
    }
  }

  const session = await prisma.tbChatSession.findFirst({
    where,
    include: {
      user: { select: { id: true, nickname: true, account: true } },
      messages: {
        orderBy: { created_at: 'asc' },
      },
    },
  });

  return session;
}

/**
 * 逻辑删除会话
 */
export async function deleteSession(id: number) {
  return prisma.tbChatSession.update({
    where: { id },
    data: { is_delete: 1 },
  });
}

/**
 * 批量逻辑删除会话
 */
export async function batchDeleteSessions(ids: number[]) {
  return prisma.tbChatSession.updateMany({
    where: { id: { in: ids } },
    data: { is_delete: 1 },
  });
}

// ============ 消息 CRUD ============

export interface MessageMetadataStep {
  type: string;
  content: string;
  toolName?: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
}

/** 消息 metadata 结构 */
export interface MessageMetadata {
  thoughts?: string[];
  reactLoops?: Array<{
    index: number;
    steps: MessageMetadataStep[];
  }>;
  reactTimeline?: Array<
    | {
        type: 'think';
        content: string;
      }
    | {
        type: 'loop';
        index: number;
        steps: MessageMetadataStep[];
      }
  >;
}

/**
 * 创建消息记录
 */
export async function createMessage(params: {
  sessionId: number;
  role: 'user' | 'assistant';
  content: string;
  metadata?: MessageMetadata | null;
}) {
  return prisma.tbChatMessage.create({
    data: {
      session_id: params.sessionId,
      role: params.role,
      content: params.content,
      metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });
}

// ============ 管理后台查询 ============

export interface AdminChatLogQuery {
  pageNum?: number;
  pageSize?: number;
  userId?: number;
  deviceId?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * 管理后台查询聊天记录
 */
export async function getAdminChatLogs(params: AdminChatLogQuery) {
  const {
    pageNum = 1,
    pageSize = 20,
    userId,
    deviceId,
    keyword,
    startDate,
    endDate,
  } = params;

  const where: Prisma.TbChatSessionWhereInput = {
    is_delete: 0,
  };

  if (userId) {
    where.user_id = userId;
  }
  if (deviceId) {
    where.device_id = { contains: deviceId };
  }
  if (keyword) {
    where.OR = [
      { title: { contains: keyword } },
      { user: { nickname: { contains: keyword } } },
      { user: { account: { contains: keyword } } },
      {
        messages: {
          some: { content: { contains: keyword } },
        },
      },
    ];
  }
  if (startDate || endDate) {
    const end = endDate ? new Date(endDate) : undefined;
    if (end) {
      end.setHours(23, 59, 59, 999);
    }

    where.created_at = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(end ? { lte: end } : {}),
    };
  }

  const [records, total] = await Promise.all([
    prisma.tbChatSession.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      skip: (pageNum - 1) * pageSize,
      take: Math.min(pageSize, 50),
      select: {
        id: true,
        title: true,
        message_count: true,
        ip_address: true,
        created_at: true,
        updated_at: true,
        device_id: true,
        user: {
          select: { id: true, nickname: true, account: true },
        },
      },
    }),
    prisma.tbChatSession.count({ where }),
  ]);

  return { record: records, total, pageNum, pageSize };
}
