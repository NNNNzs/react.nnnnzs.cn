import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requireAuth } from '@/lib/permission';
import {
  CONTENT_TEMPLATE_SCENARIOS,
  CONTENT_TEMPLATE_STATUSES,
  CONTENT_TEMPLATE_TYPES,
  createContentTemplate,
  listContentTemplates,
} from '@/services/content-creation';
import type { Prisma } from '@/generated/prisma-client/client';
import {
  getNumberParam,
  getStringParam,
  validationErrorResponse,
} from '../_utils';

const createTemplateSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(255, '名称不能超过255个字符'),
  type: z.enum(CONTENT_TEMPLATE_TYPES),
  scenario: z.enum(CONTENT_TEMPLATE_SCENARIOS),
  content: z.string().min(1, '模板内容不能为空').max(200000, '模板内容过长'),
  variables_json: z.unknown().optional().nullable(),
  output_schema_json: z.unknown().optional().nullable(),
  version: z.coerce.number().int().positive().optional(),
  status: z.enum(CONTENT_TEMPLATE_STATUSES).optional(),
  source_path: z.string().max(255).optional().nullable(),
});

function asInputJson(value: unknown) {
  return value as Prisma.InputJsonValue | null | undefined;
}

export async function GET(request: NextRequest) {
  try {
    const check = await requireAuth(request);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const searchParams = request.nextUrl.searchParams;
    const result = await listContentTemplates({
      pageNum: getNumberParam(searchParams.get('pageNum')),
      pageSize: getNumberParam(searchParams.get('pageSize')),
      query: getStringParam(searchParams.get('query')),
      status: getStringParam(searchParams.get('status')),
      type: getStringParam(searchParams.get('type')),
      scenario: getStringParam(searchParams.get('scenario')),
    });

    return NextResponse.json(successResponse(result), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('获取内容模板失败:', error);
    return NextResponse.json(errorResponse('获取内容模板失败'), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const check = await requireAuth(request);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const validation = createTemplateSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const result = await createContentTemplate({
      ...validation.data,
      variables_json: asInputJson(validation.data.variables_json),
      output_schema_json: asInputJson(validation.data.output_schema_json),
      created_by: check.user.id,
    });

    return NextResponse.json(successResponse(result, '模板已创建'), {
      status: 201,
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('创建内容模板失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '创建内容模板失败'),
      { status: 500 },
    );
  }
}
