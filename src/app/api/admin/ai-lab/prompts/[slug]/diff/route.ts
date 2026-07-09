import { NextRequest, NextResponse } from 'next/server';
import { CONFIG_VIEW } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission } from '@/lib/permission';
import { diffAiTemplateVersions } from '@/services/ai-template';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export const descriptor: ApiDescriptor = {
  code: 'ai_lab_prompts_diff',
  name: 'AI Lab Prompt 版本对比',
  description: '对比两个版本的模板正文差异',
  module: 'ai_lab',
  method: 'GET',
  permissionCode: CONFIG_VIEW,
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const check = await requirePermission(request, CONFIG_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);
    const from = Number(searchParams.get('from'));
    const to = Number(searchParams.get('to'));

    if (!Number.isInteger(from) || !Number.isInteger(to) || from <= 0 || to <= 0) {
      return NextResponse.json(errorResponse('无效的版本号'), { status: 400 });
    }

    const result = await diffAiTemplateVersions(decodeURIComponent(slug), from, to);
    return NextResponse.json(successResponse(result), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('查询 AI Prompt 模板 diff 失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '查询 AI Prompt 模板 diff 失败'),
      { status: 500 },
    );
  }
}
