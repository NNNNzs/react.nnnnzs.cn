/**
 * 图片生成日志查询 API
 * GET /api/image-gen/logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { IMAGE_VIEW, USER_MANAGE } from '@/constants/permissions';
import { getImageGenLogs } from '@/services/image-gen-log';

export async function GET(request: NextRequest) {
  try {
    const check = await requirePermission(request, IMAGE_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { searchParams } = new URL(request.url);
    const pageNum = parseInt(searchParams.get('pageNum') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const source = searchParams.get('source') as 'ADMIN' | 'MCP' | null;
    const status = searchParams.get('status') as 'SUCCESS' | 'FAILED' | null;

    // 管理员可查所有用户，普通用户只能查自己的
    const isAdmin = check.user.permissions.includes(USER_MANAGE);

    const result = await getImageGenLogs({
      pageNum,
      pageSize: Math.min(pageSize, 50),
      source: source || undefined,
      status: status || undefined,
      userId: isAdmin ? undefined : check.user.id,
    });

    return NextResponse.json(successResponse(result));
  } catch (error) {
    console.error('Query image gen logs error:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '查询失败'),
      { status: 500 }
    );
  }
}
