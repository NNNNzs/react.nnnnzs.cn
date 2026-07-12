import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CONTENT_EDIT, CONTENT_VIEW } from '@/constants/permissions';
import { errorResponse } from '@/dto/response.dto';
import { createSSEResponse } from '@/lib/sse';
import { hasDataPermission, requirePermission } from '@/lib/permission';
import { topicAgentStream } from '@/services/ai/topic-agent';
import { getContentTopic } from '@/services/content-creation';
import { validationErrorResponse } from '../../../_utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const chatSchema = z.object({
  message: z.string().min(1, '消息不能为空').max(8000, '消息过长'),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(20000),
  })).max(20, '历史消息过多').optional().default([]),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id } = await context.params;
    const topicId = Number(id);
    if (!Number.isInteger(topicId) || topicId <= 0) {
      return NextResponse.json(errorResponse('选题 ID 无效'), { status: 400 });
    }

    const topic = await getContentTopic(topicId);
    if (!topic) return NextResponse.json(errorResponse('选题不存在'), { status: 404 });
    if (!hasDataPermission(check.user, CONTENT_EDIT, topic.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
    }

    const validation = chatSchema.safeParse(await request.json());
    if (!validation.success) return validationErrorResponse(validation.error);

    const scopeAll = hasDataPermission(check.user, CONTENT_VIEW);
    const stream = await topicAgentStream({
      topicId,
      actorUserId: check.user.id,
      scopeUserId: scopeAll ? undefined : check.user.id,
      message: validation.data.message,
      history: validation.data.history,
    });
    return createSSEResponse(stream);
  } catch (error) {
    console.error('[topic-agent] 完善选题对话失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '选题助手对话失败'),
      { status: 500 },
    );
  }
}
