import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { requireAuth } from '@/lib/permission';
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
  type: z.enum(CONTENT_DRAFT_TYPES).default('note'),
  status: z.enum(CONTENT_DRAFT_STATUSES).default('DRAFT'),
});

export async function GET(request: NextRequest) {
  try {
    const check = await requireAuth(request);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const searchParams = request.nextUrl.searchParams;
    const result = await listContentDrafts({
      pageNum: getNumberParam(searchParams.get('pageNum')),
      pageSize: getNumberParam(searchParams.get('pageSize')),
      query: getStringParam(searchParams.get('query')),
      status: getStringParam(searchParams.get('status')),
      type: getStringParam(searchParams.get('type')),
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
    const check = await requireAuth(request);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const validation = createDraftSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const result = await createContentDraft({
      ...validation.data,
      platform: 'xhs',
      created_by: check.user.id,
    });

    return NextResponse.json(successResponse(result, '草稿已创建'), { status: 201 });
  } catch (error) {
    console.error('创建内容草稿失败:', error);
    return NextResponse.json(errorResponse('创建内容草稿失败'), { status: 500 });
  }
}
