/**
 * 图片生成日志查询 / 批量删除 API
 * GET  /api/image-gen/logs
 * DELETE /api/image-gen/logs  body: { ids: number[], deleteCos?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { IMAGE_VIEW, USER_MANAGE } from '@/constants/permissions';
import { getImageGenLogs, batchDeleteImageGenLogs } from '@/services/image-gen-log';

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

export async function DELETE(request: NextRequest) {
  try {
    const check = await requirePermission(request, USER_MANAGE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const body = await request.json();
    const { ids, deleteCos } = body as { ids?: number[]; deleteCos?: boolean };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(errorResponse('ids 不能为空'), { status: 400 });
    }

    const validIds = ids.filter((id) => Number.isInteger(id) && id > 0);
    if (validIds.length === 0) {
      return NextResponse.json(errorResponse('无有效的记录 ID'), { status: 400 });
    }

    const result = await batchDeleteImageGenLogs(validIds, {
      deleteCos: Boolean(deleteCos),
    });

    if (result.failedCosUrls.length > 0) {
      console.error('批量删除图片生成记录时，部分 COS 文件删除失败:', {
        failedCosUrls: result.failedCosUrls,
      });
    }

    return NextResponse.json(successResponse({
      deletedCount: result.deletedCount,
      deletedCosUrls: result.deletedCosUrls,
      failedCosUrls: result.failedCosUrls,
    }, '批量删除成功'));
  } catch (error) {
    console.error('Batch delete image gen logs error:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '批量删除失败'),
      { status: 500 }
    );
  }
}
