import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CONFIG_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission } from '@/lib/permission';
import {
  compilePromptTemplate,
  createMustachePromptTemplate,
  getMustacheVariables,
  loadPromptTemplate,
} from '@/services/ai-template';
import type { ApiDescriptor } from '@/types/api-descriptor';

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

export const descriptor: ApiDescriptor = {
  code: 'ai_lab_prompts_render',
  name: 'AI Lab Prompt 渲染',
  description: '渲染指定版本的 Prompt 模板，支持变量替换和 @mention 编译',
  module: 'ai_lab',
  method: 'POST',
  permissionCode: CONFIG_VIEW,
};

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

    const loaded = await loadPromptTemplate({
      slug: validation.data.slug,
      version: validation.data.version,
    });
    const rawContent = loaded.version.rawContent;
    const compiled = validation.data.compileMentions
      ? await compilePromptTemplate(rawContent)
      : null;
    const [content, compiledContent] = await Promise.all([
      createMustachePromptTemplate(rawContent).format(validation.data.variables ?? {}),
      createMustachePromptTemplate(compiled?.content ?? rawContent)
        .format(validation.data.variables ?? {}),
    ]);

    return NextResponse.json(successResponse({
      slug: loaded.template.slug,
      version: loaded.version.version,
      content,
      variables: getMustacheVariables(rawContent),
      checksum: loaded.version.checksum,
      compiledContent,
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
