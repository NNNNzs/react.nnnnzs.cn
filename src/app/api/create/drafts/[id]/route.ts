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
import type { ApiDescriptor } from '@/types/api-descriptor';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const updateDraftSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(255, '标题不能超过255个字符').optional(),
  hook: z.string().max(5000).optional().nullable(),
  body: z.string().max(100000).optional().nullable(),
  tags: z.array(z.string().min(1)).max(20).optional().nullable(),
  type: z.enum(CONTENT_DRAFT_TYPES).optional(),
  status: z.enum(CONTENT_DRAFT_STATUSES).optional(),
});

const draftIdInputSchema = { id: { type: 'number', description: '草稿 ID' } };

export const getDescriptor: ApiDescriptor = {
  code: 'create_drafts_get', name: '草稿详情', description: '按 ID 获取草稿正文、标签、图卡和已选素材。',
  module: 'content', method: 'GET', permissionCode: CONTENT_VIEW,
  inputSchema: { type: 'object', properties: draftIdInputSchema, required: ['id'] },
};

export const updateDescriptor: ApiDescriptor = {
  code: 'create_drafts_update', name: '更新草稿', description: '更新草稿标题、开头、正文、标签、类型或状态。',
  module: 'content', method: 'PATCH', permissionCode: CONTENT_EDIT,
  inputSchema: {
    type: 'object',
    properties: {
      ...draftIdInputSchema,
      title: { type: 'string', description: '草稿标题' },
      hook: { type: 'string', description: '开头或钩子文案；传空字符串可清空' },
      body: { type: 'string', description: '草稿正文；传空字符串可清空' },
      tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
      type: { type: 'string', description: '草稿类型' },
      status: { type: 'string', description: '草稿状态' },
    },
    required: ['id'],
  },
};

export const deleteDescriptor: ApiDescriptor = {
  code: 'create_drafts_delete', name: '删除草稿', description: '按 ID 删除一个草稿。',
  module: 'content', method: 'DELETE', permissionCode: CONTENT_DELETE,
  inputSchema: { type: 'object', properties: draftIdInputSchema, required: ['id'] },
};

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
    if (existing.platform === 'zhihu' && validation.data.type && validation.data.type !== 'article') {
      return NextResponse.json(errorResponse('知乎草稿必须使用长文 / Markdown 类型'), { status: 400 });
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
