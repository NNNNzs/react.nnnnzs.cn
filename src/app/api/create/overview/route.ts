import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { requirePermission, hasDataPermission } from '@/lib/permission';
import { CONTENT_VIEW } from '@/constants/permissions';
import { getContentCreationOverview } from '@/services/content-creation';

export async function GET(request: NextRequest) {
  try {
    const check = await requirePermission(request, CONTENT_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const scopeAll = hasDataPermission(check.user, CONTENT_VIEW);
    const result = await getContentCreationOverview(scopeAll ? null : check.user.id);
    return NextResponse.json(successResponse(result));
  } catch (error) {
    console.error('获取内容创作概览失败:', error);
    return NextResponse.json(errorResponse('获取内容创作概览失败'), { status: 500 });
  }
}
