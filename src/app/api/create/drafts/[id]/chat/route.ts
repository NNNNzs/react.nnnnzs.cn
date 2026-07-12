/**
 * 创作助手对话 API
 * POST /api/create/drafts/[id]/chat
 *
 * 返回标准 SSE 多事件流（meta/token/tool_start/tool_end/patch/error/done）。
 * 会话不持久化（第一期内存级），前端自行维护 history。
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse } from '@/dto/response.dto';
import { requirePermission, hasDataPermission } from '@/lib/permission';
import { CONTENT_EDIT } from '@/constants/permissions';
import { getContentDraft } from '@/services/content-creation';
import { createSSEResponse } from '@/lib/sse';
import { createAgentStream } from '@/services/ai/create-agent';
import type { CreateAgentPageContext } from '@/types/create-agent';
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
  pageContext: z.object({
    title: z.string().max(255),
    hook: z.string().max(5000),
    body: z.string().max(100000),
    tags: z.array(z.string().max(100)).max(20),
    type: z.string().max(50),
    status: z.string().max(30),
  }).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id } = await context.params;
    const draftId = Number(id);
    if (!Number.isInteger(draftId) || draftId <= 0) {
      return NextResponse.json(errorResponse('草稿 ID 无效'), { status: 400 });
    }

    const draft = await getContentDraft(draftId);
    if (!draft) {
      return NextResponse.json(errorResponse('草稿不存在'), { status: 404 });
    }

    if (!hasDataPermission(check.user, CONTENT_EDIT, draft.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
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
      pageContext: validation.data.pageContext as CreateAgentPageContext | undefined,
    });

    return createSSEResponse(stream);
  } catch (error) {
    console.error('[create-agent] 对话失败:', error);
    const message = error instanceof Error ? error.message : '创作助手对话失败';
    return NextResponse.json(errorResponse(message), { status: 500 });
  }
}
