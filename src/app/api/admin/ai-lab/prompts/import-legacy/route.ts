import { NextRequest, NextResponse } from 'next/server';
import { CONFIG_EDIT } from '@/constants/permissions';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission } from '@/lib/permission';
import { importLegacyContentTemplates } from '@/services/ai-template';
import type { ApiDescriptor } from '@/types/api-descriptor';

export const runtime = 'nodejs';

export const descriptor: ApiDescriptor = {
  code: 'ai_lab_prompts_import_legacy',
  name: 'AI Lab Prompt 导入旧模板',
  description: '将 content_templates 旧模板同步到系统级 Prompt / Skill 模板表',
  module: 'ai_lab',
  method: 'POST',
  permissionCode: CONFIG_EDIT,
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export async function POST(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONFIG_EDIT);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const result = await importLegacyContentTemplates(check.user.id);

    return NextResponse.json(successResponse(result, '旧模板已同步到 AI Lab Prompts'), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('导入旧内容模板失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '导入旧内容模板失败'),
      { status: 500 },
    );
  }
}
