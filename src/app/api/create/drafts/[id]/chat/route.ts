/**
 * 创作助手对话 API
 * POST /api/create/drafts/[id]/chat
 *
 * 返回标准 SSE 多事件流（meta/token/tool_start/tool_end/draft_patch/error/done）。
 * 会话不持久化（第一期内存级），前端自行维护 history。
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse } from '@/dto/response.dto';
import { requireAuth } from '@/lib/permission';
import { createSSEResponse } from '@/lib/sse';
import { createAgentStream } from '@/services/ai/create-agent';
import { validationErrorResponse } from '../../../_utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const chatSchema = z.object({
  message: z.string().min(1, '消息不能为空').max(8000, '消息过长'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .max(20, '历史消息过多')
    .optional()
    .default([]),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const check = await requireAuth(request);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id } = await context.params;
    const draftId = Number(id);
    if (!Number.isInteger(draftId) || draftId <= 0) {
      return NextResponse.json(errorResponse('草稿 ID 无效'), { status: 400 });
    }

    const validation = chatSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const stream = await createAgentStream({
      draftId,
      userId: check.user.id,
      message: validation.data.message,
      history: validation.data.history,
    });

    return createSSEResponse(stream);
  } catch (error) {
    console.error('[create-agent] 对话失败:', error);
    const message = error instanceof Error ? error.message : '创作助手对话失败';
    return NextResponse.json(errorResponse(message), { status: 500 });
  }
}
