import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { requireAuth } from '@/lib/permission';
import {
  createContentTopic,
  listContentTopics,
} from '@/services/content-creation';
import {
  getNumberParam,
  getStringParam,
  validationErrorResponse,
} from '../_utils';

const createTopicSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(255, '标题不能超过255个字符'),
  description: z.string().max(5000).optional().nullable(),
  pillar: z.string().max(80).optional().nullable(),
  series: z.string().max(80).optional().nullable(),
  status: z.string().max(30).optional(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
  source_post_id: z.coerce.number().int().positive().optional().nullable(),
  source_note: z.string().max(5000).optional().nullable(),
  ai_reason: z.string().max(5000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const check = await requireAuth(request);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const searchParams = request.nextUrl.searchParams;
    const result = await listContentTopics({
      pageNum: getNumberParam(searchParams.get('pageNum')),
      pageSize: getNumberParam(searchParams.get('pageSize')),
      query: getStringParam(searchParams.get('query')),
      status: getStringParam(searchParams.get('status')),
      sourcePostId: getNumberParam(searchParams.get('sourcePostId')),
    });

    return NextResponse.json(successResponse(result));
  } catch (error) {
    console.error('获取内容选题失败:', error);
    return NextResponse.json(errorResponse('获取内容选题失败'), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const check = await requireAuth(request);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const validation = createTopicSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const result = await createContentTopic({
      ...validation.data,
      created_by: check.user.id,
    });

    return NextResponse.json(successResponse(result, '选题已创建'));
  } catch (error) {
    console.error('创建内容选题失败:', error);
    return NextResponse.json(errorResponse('创建内容选题失败'), { status: 500 });
  }
}
