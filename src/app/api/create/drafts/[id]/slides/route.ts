import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CONTENT_EDIT } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission, hasDataPermission } from '@/lib/permission';
import { getContentDraft, replaceContentDraftSlides } from '@/services/content-creation';
import { validationErrorResponse } from '../../../_utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const slidesSchema = z.object({
  slides: z.array(z.object({
    id: z.coerce.number().int().positive().optional(),
    title: z.string().max(255).optional().nullable(),
    bullets: z.array(z.string().max(500)).max(12).optional().nullable(),
    prompt: z.string().min(1).max(10000),
  })).max(12),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_EDIT);
    if ('error' in check) return NextResponse.json(errorResponse(check.error), { status: check.status });
    const { id } = await context.params;
    const draftId = Number(id);
    if (!Number.isInteger(draftId) || draftId <= 0) {
      return NextResponse.json(errorResponse('无效的草稿 ID'), { status: 400 });
    }
    const draft = await getContentDraft(draftId);
    if (!draft) return NextResponse.json(errorResponse('草稿不存在'), { status: 404 });
    if (!hasDataPermission(check.user, CONTENT_EDIT, draft.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
    }
    const validation = slidesSchema.safeParse(await request.json());
    if (!validation.success) return validationErrorResponse(validation.error);
    const result = await replaceContentDraftSlides(draftId, validation.data.slides);
    return NextResponse.json(successResponse(result, '图卡计划已保存'), {
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    });
  } catch (error) {
    console.error('保存草稿图卡计划失败:', error);
    return NextResponse.json(errorResponse(error instanceof Error ? error.message : '保存草稿图卡计划失败'), { status: 500 });
  }
}
