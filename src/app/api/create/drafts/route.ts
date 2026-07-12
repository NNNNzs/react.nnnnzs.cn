import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { requirePermission, hasDataPermission } from '@/lib/permission';
import { CONTENT_VIEW, CONTENT_CREATE } from '@/constants/permissions';
import {
  CONTENT_DRAFT_STATUSES,
  CONTENT_DRAFT_TYPES,
  createContentDraft,
  listContentDrafts,
} from '@/services/content-creation';
import {
  getNumberParam,
  getStringParam,
  validationErrorResponse,
} from '../_utils';

const createDraftSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(255, '标题不能超过255个字符'),
  platform: z.enum(['xhs', 'zhihu']).default('xhs'),
  type: z.enum(CONTENT_DRAFT_TYPES).default('note'),
  status: z.enum(CONTENT_DRAFT_STATUSES).default('DRAFT'),
}).superRefine((value, context) => {
  if (value.platform === 'zhihu' && value.type !== 'article') {
    context.addIssue({
      code: 'custom',
      path: ['type'],
      message: '知乎草稿必须使用长文 / Markdown 类型',
    });
  }
});

export async function GET(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONTENT_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const searchParams = request.nextUrl.searchParams;
    const scopeAll = hasDataPermission(check.user, CONTENT_VIEW);
    const result = await listContentDrafts({
      pageNum: getNumberParam(searchParams.get('pageNum')),
      pageSize: getNumberParam(searchParams.get('pageSize')),
      query: getStringParam(searchParams.get('query')),
      status: getStringParam(searchParams.get('status')),
      type: getStringParam(searchParams.get('type')),
      userId: scopeAll ? undefined : check.user.id,
    });

    return NextResponse.json(successResponse(result), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('获取内容草稿失败:', error);
    return NextResponse.json(errorResponse('获取内容草稿失败'), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONTENT_CREATE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const validation = createDraftSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const result = await createContentDraft({
      ...validation.data,
      created_by: check.user.id,
    });

    return NextResponse.json(successResponse(result, '草稿已创建'), { status: 201 });
  } catch (error) {
    console.error('创建内容草稿失败:', error);
    return NextResponse.json(errorResponse('创建内容草稿失败'), { status: 500 });
  }
}
