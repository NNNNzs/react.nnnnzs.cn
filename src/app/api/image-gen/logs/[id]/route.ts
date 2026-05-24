/**
 * 图片生成日志删除 API
 * DELETE /api/image-gen/logs/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { USER_MANAGE } from '@/constants/permissions';
import { deleteImageGenLog } from '@/services/image-gen-log';

interface DeleteImageGenLogBody {
  deleteCos?: boolean;
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const check = await requirePermission(request, USER_MANAGE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id } = await context.params;
    const logId = Number(id);
    if (!Number.isInteger(logId) || logId <= 0) {
      return NextResponse.json(errorResponse('无效的记录 ID'), { status: 400 });
    }

    let body: DeleteImageGenLogBody = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const result = await deleteImageGenLog(logId, {
      deleteCos: Boolean(body.deleteCos),
    });

    if (result.failedCosUrls.length > 0) {
      console.error('删除图片生成记录时，部分 COS 文件删除失败:', {
        logId,
        failedCosUrls: result.failedCosUrls,
      });
    }

    return NextResponse.json(successResponse({
      deletedCosUrls: result.deletedCosUrls,
      failedCosUrls: result.failedCosUrls,
    }, '删除成功'));
  } catch (error) {
    console.error('删除图片生成日志失败:', error);
    const errorMessage = error instanceof Error ? error.message : '删除失败';
    const status = errorMessage.includes('不存在') ? 404 : 500;
    return NextResponse.json(errorResponse(errorMessage), { status });
  }
}
