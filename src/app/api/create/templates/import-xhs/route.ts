import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { requirePermission } from '@/lib/permission';
import { CONTENT_CREATE } from '@/constants/permissions';
import { importXhsPromptTemplates } from '@/services/content-creation';

export async function POST(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONTENT_CREATE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const result = await importXhsPromptTemplates(check.user.id);

    return NextResponse.json(
      successResponse(result, `导入完成：新增 ${result.created.length} 个，更新 ${result.updated.length} 个`),
      {
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      },
    );
  } catch (error) {
    console.error('导入 xhs 提示词失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '导入 xhs 提示词失败'),
      { status: 500 },
    );
  }
}
