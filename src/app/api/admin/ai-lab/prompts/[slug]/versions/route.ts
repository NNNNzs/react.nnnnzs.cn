import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CONFIG_EDIT } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission } from '@/lib/permission';
import { createAiTemplateVersion } from '@/services/ai-template';
import type { Prisma } from '@/generated/prisma-client/client';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const createVersionSchema = z.object({
  content: z.string().min(1).max(300000),
  metadata: z.unknown().optional().nullable(),
  changeNote: z.string().max(2000).optional().nullable(),
  activate: z.boolean().optional(),
});

function asInputJson(value: unknown) {
  return value as Prisma.InputJsonValue | null | undefined;
}

function validationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    errorResponse(`输入验证失败: ${error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`),
    { status: 400 },
  );
}

export const createDescriptor: ApiDescriptor = {
  code: 'ai_lab_prompts_create_version',
  name: 'AI Lab Prompt 创建版本',
  description: '为指定 Prompt/Skill 模板创建新版本',
  module: 'ai_lab',
  method: 'POST',
  permissionCode: CONFIG_EDIT,
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONFIG_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { slug } = await context.params;
    const validation = createVersionSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const result = await createAiTemplateVersion({
      slug: decodeURIComponent(slug),
      content: validation.data.content,
      metadata: asInputJson(validation.data.metadata),
      changeNote: validation.data.changeNote,
      activate: validation.data.activate,
      createdBy: check.user.id,
    });

    return NextResponse.json(successResponse(result, '模板版本已创建'), {
      status: 201,
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('创建 AI Prompt 模板版本失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '创建 AI Prompt 模板版本失败'),
      { status: 500 },
    );
  }
}
