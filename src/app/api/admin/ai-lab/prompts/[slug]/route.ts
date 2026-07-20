import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AI_TEMPLATE_SCOPES,
  AI_TEMPLATE_STATUSES,
  AI_TEMPLATE_TYPES,
} from '@/constants/ai-template';
import { CONFIG_EDIT, CONFIG_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission } from '@/lib/permission';
import {
  activateAiTemplateVersion,
  getAiTemplateBySlug,
  updateAiTemplate,
} from '@/services/ai-template';
import type { Prisma } from '@/generated/prisma-client/client';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const updateTemplateSchema = z.object({
  key: z.string().max(120).optional().nullable(),
  name: z.string().min(1).max(200).optional(),
  type: z.enum(AI_TEMPLATE_TYPES).optional(),
  scope: z.enum(AI_TEMPLATE_SCOPES).optional(),
  description: z.string().max(2000).optional().nullable(),
  aliases: z.array(z.string().min(1).max(120)).optional(),
  metadata: z.unknown().optional().nullable(),
  status: z.enum(AI_TEMPLATE_STATUSES).optional(),
  currentVersion: z.coerce.number().int().positive().optional(),
});

function jsonHeaders() {
  return {
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
  };
}

function asInputJson(value: unknown) {
  return value as Prisma.InputJsonValue | null | undefined;
}

function validationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    errorResponse(`输入验证失败: ${error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`),
    { status: 400 },
  );
}

export const getDescriptor: ApiDescriptor = {
  code: 'ai_lab_prompts_get',
  name: 'AI Lab Prompt 模板详情',
  description: '查询单个 Prompt 模板详情及版本列表',
  module: 'ai_lab',
  method: 'GET',
  permissionCode: CONFIG_VIEW,
};

export const updateDescriptor: ApiDescriptor = {
  code: 'ai_lab_prompts_update',
  name: 'AI Lab Prompt 模板更新',
  description: '更新 Prompt 模板元数据或启用指定版本',
  module: 'ai_lab',
  method: 'PATCH',
  permissionCode: CONFIG_EDIT,
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONFIG_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { slug } = await context.params;
    const template = await getAiTemplateBySlug(decodeURIComponent(slug));
    if (!template) {
      return NextResponse.json(errorResponse('模板不存在'), { status: 404 });
    }

    return NextResponse.json(successResponse(template), { headers: jsonHeaders() });
  } catch (error) {
    console.error('查询 AI Prompt 模板详情失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '查询 AI Prompt 模板详情失败'),
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONFIG_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { slug } = await context.params;
    const validation = updateTemplateSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    if (validation.data.currentVersion) {
      const activated = await activateAiTemplateVersion(
        decodeURIComponent(slug),
        validation.data.currentVersion,
      );
      return NextResponse.json(successResponse(activated, '模板版本已启用'), {
        headers: jsonHeaders(),
      });
    }

    const result = await updateAiTemplate(decodeURIComponent(slug), {
      ...validation.data,
      metadata: asInputJson(validation.data.metadata),
    });

    return NextResponse.json(successResponse(result, '模板已保存'), {
      headers: jsonHeaders(),
    });
  } catch (error) {
    console.error('更新 AI Prompt 模板失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '更新 AI Prompt 模板失败'),
      { status: 500 },
    );
  }
}
