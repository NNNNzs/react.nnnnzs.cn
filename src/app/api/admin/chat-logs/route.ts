/**
 * 管理后台聊天记录 API
 * GET    /api/admin/chat-logs — 查询聊天记录列表
 * DELETE /api/admin/chat-logs — 批量删除聊天记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { CHAT_LOG_VIEW, CHAT_LOG_DELETE } from '@/constants/permissions';
import { getAdminChatLogs, batchDeleteSessions } from '@/services/chat-log';

/**
 * 查询聊天记录列表
 */
export async function GET(request: NextRequest) {
  try {
    const check = await requirePermission(request, CHAT_LOG_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { searchParams } = new URL(request.url);
    const result = await getAdminChatLogs({
      pageNum: parseInt(searchParams.get('pageNum') || '1', 10),
      pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
      userId: searchParams.get('userId') ? parseInt(searchParams.get('userId')!, 10) : undefined,
      deviceId: searchParams.get('deviceId') || undefined,
      keyword: searchParams.get('keyword') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    return NextResponse.json(successResponse(result), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('Get admin chat logs error:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '查询聊天记录失败'),
      { status: 500 },
    );
  }
}

/**
 * 批量删除聊天记录
 */
export async function DELETE(request: NextRequest) {
  try {
    const check = await requirePermission(request, CHAT_LOG_DELETE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const body = await request.json();
    const { ids } = body as { ids?: number[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(errorResponse('ids 不能为空'), { status: 400 });
    }

    const validIds = ids.filter((id) => Number.isInteger(id) && id > 0);
    if (validIds.length === 0) {
      return NextResponse.json(errorResponse('无有效的记录 ID'), { status: 400 });
    }

    const result = await batchDeleteSessions(validIds);

    return NextResponse.json(
      successResponse({ deletedCount: result.count }, '批量删除成功'),
    );
  } catch (error) {
    console.error('Batch delete chat logs error:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '批量删除失败'),
      { status: 500 },
    );
  }
}
