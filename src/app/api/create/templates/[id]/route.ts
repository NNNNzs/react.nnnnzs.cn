import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requireAuth } from '@/lib/permission';
import {
  CONTENT_TEMPLATE_SCENARIOS,
  CONTENT_TEMPLATE_STATUSES,
  CONTENT_TEMPLATE_TYPES,
  archiveContentTemplate,
  getContentTemplate,
  updateContentTemplate,
} from '@/services/content-creation';
import type { Prisma } from '@/generated/prisma-client/client';
import { validationErrorResponse } from '../../_utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const updateTemplateSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(255, '名称不能超过255个字符').optional(),
  type: z.enum(CONTENT_TEMPLATE_TYPES).optional(),
  scenario: z.enum(CONTENT_TEMPLATE_SCENARIOS).optional(),
  content: z.string().min(1, '模板内容不能为空').max(200000, '模板内容过长').optional(),
  variables_json: z.unknown().optional().nullable(),
  output_schema_json: z.unknown().optional().nullable(),
  version: z.coerce.number().int().positive().optional(),
  status: z.enum(CONTENT_TEMPLATE_STATUSES).optional(),
  source_path: z.string().max(255).optional().nullable(),
});

function asInputJson(value: unknown) {
  return value as Prisma.InputJsonValue | null | undefined;
}

async function readTemplateId(context: RouteContext) {
  const { id } = await context.params;
  const templateId = Number(id);
  return Number.isInteger(templateId) && templateId > 0 ? templateId : null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const check = await requireAuth(request);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const templateId = await readTemplateId(context);
    if (!templateId) {
      return NextResponse.json(errorResponse('无效的模板 ID'), { status: 400 });
    }

    const template = await getContentTemplate(templateId);
    if (!template) {
      return NextResponse.json(errorResponse('模板不存在'), { status: 404 });
    }

    return NextResponse.json(successResponse(template), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('获取内容模板详情失败:', error);
    return NextResponse.json(errorResponse('获取内容模板详情失败'), { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const check = await requireAuth(request);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const templateId = await readTemplateId(context);
    if (!templateId) {
      return NextResponse.json(errorResponse('无效的模板 ID'), { status: 400 });
    }

    const existing = await getContentTemplate(templateId);
    if (!existing) {
      return NextResponse.json(errorResponse('模板不存在'), { status: 404 });
    }

    const validation = updateTemplateSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const result = await updateContentTemplate(templateId, {
      ...validation.data,
      variables_json: asInputJson(validation.data.variables_json),
      output_schema_json: asInputJson(validation.data.output_schema_json),
    });

    return NextResponse.json(successResponse(result, '模板已保存'), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('更新内容模板失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '更新内容模板失败'),
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const check = await requireAuth(request);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const templateId = await readTemplateId(context);
    if (!templateId) {
      return NextResponse.json(errorResponse('无效的模板 ID'), { status: 400 });
    }

    const existing = await getContentTemplate(templateId);
    if (!existing) {
      return NextResponse.json(errorResponse('模板不存在'), { status: 404 });
    }

    const result = await archiveContentTemplate(templateId);
    return NextResponse.json(successResponse(result, '模板已归档'), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('归档内容模板失败:', error);
    return NextResponse.json(errorResponse('归档内容模板失败'), { status: 500 });
  }
}
