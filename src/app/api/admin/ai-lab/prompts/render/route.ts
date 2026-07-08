import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CONFIG_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission } from '@/lib/permission';
import { compilePromptTemplate, renderAiTemplate } from '@/services/ai-template';

export const runtime = 'nodejs';

const renderSchema = z.object({
  slug: z.string().min(1),
  version: z.coerce.number().int().positive().optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
  compileMentions: z.boolean().optional(),
});

function validationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    errorResponse(`输入验证失败: ${error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`),
    { status: 400 },
  );
}

export async function POST(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONFIG_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const validation = renderSchema.safeParse(await request.json());
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const rendered = await renderAiTemplate(validation.data);
    const compiled = validation.data.compileMentions
      ? await compilePromptTemplate(rendered.content)
      : null;

    return NextResponse.json(successResponse({
      ...rendered,
      compiledContent: compiled?.content ?? rendered.content,
      mentions: compiled?.mentions ?? [],
    }), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('渲染 AI Prompt 模板失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '渲染 AI Prompt 模板失败'),
      { status: 500 },
    );
  }
}
