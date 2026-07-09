import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission, hasDataPermission } from '@/lib/permission';
import { CONTENT_VIEW, CONTENT_EDIT, CONTENT_DELETE } from '@/constants/permissions';
import {
  CONTENT_DRAFT_STATUSES,
  CONTENT_DRAFT_TYPES,
  deleteContentDraft,
  getContentDraft,
  updateContentDraft,
} from '@/services/content-creation';
import { validationErrorResponse } from '../../_utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const updateDraftSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(255, '标题不能超过255个字符').optional(),
  hook: z.string().max(5000).optional().nullable(),
  body: z.string().max(100000).optional().nullable(),
  tags: z.array(z.string().min(1)).max(20).optional().nullable(),
  type: z.enum(CONTENT_DRAFT_TYPES).optional(),
  status: z.enum(CONTENT_DRAFT_STATUSES).optional(),
});

async function readDraftId(context: RouteContext) {
  const { id } = await context.params;
  const draftId = Number(id);
  return Number.isInteger(draftId) && draftId > 0 ? draftId : null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const draftId = await readDraftId(context);
    if (!draftId) {
      return NextResponse.json(errorResponse('无效的草稿 ID'), { status: 400 });
    }

    const draft = await getContentDraft(draftId);
    if (!draft) {
      return NextResponse.json(errorResponse('草稿不存在'), { status: 404 });
    }

    if (!hasDataPermission(check.user, CONTENT_VIEW, draft.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
    }

    return NextResponse.json(successResponse(draft), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('获取内容草稿详情失败:', error);
    return NextResponse.json(errorResponse('获取内容草稿详情失败'), { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const draftId = await readDraftId(context);
    if (!draftId) {
      return NextResponse.json(errorResponse('无效的草稿 ID'), { status: 400 });
    }

    const existing = await getContentDraft(draftId);
    if (!existing) {
      return NextResponse.json(errorResponse('草稿不存在'), { status: 404 });
    }

    if (!hasDataPermission(check.user, CONTENT_EDIT, existing.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
    }

    const validation = updateDraftSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const draft = await updateContentDraft(draftId, validation.data);
    return NextResponse.json(successResponse(draft, '草稿已保存'), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('更新内容草稿失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '更新内容草稿失败'),
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONTENT_DELETE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const draftId = await readDraftId(context);
    if (!draftId) {
      return NextResponse.json(errorResponse('无效的草稿 ID'), { status: 400 });
    }

    const draft = await getContentDraft(draftId);
    if (!draft) {
      return NextResponse.json(errorResponse('草稿不存在'), { status: 404 });
    }

    if (!hasDataPermission(check.user, CONTENT_DELETE, draft.created_by)) {
      return NextResponse.json(errorResponse('无权限操作此资源'), { status: 403 });
    }

    await deleteContentDraft(draftId);
    return NextResponse.json(successResponse(null, '草稿已删除'), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('删除内容草稿失败:', error);
    return NextResponse.json(errorResponse('删除内容草稿失败'), { status: 500 });
  }
}
