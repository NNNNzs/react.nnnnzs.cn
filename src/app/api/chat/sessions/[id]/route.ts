/**
 * 单个会话 API
 * GET    /api/chat/sessions/[id] — 获取会话详情（含消息）
 * DELETE /api/chat/sessions/[id] — 删除会话
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { requirePermission } from '@/lib/permission';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { CHAT_LOG_DELETE, CHAT_LOG_VIEW } from '@/constants/permissions';
import { getSessionDetail, deleteSession } from '@/services/chat-log';

/**
 * 获取会话详情（含消息列表）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id, 10);

    if (isNaN(sessionId)) {
      return NextResponse.json(errorResponse('无效的会话ID'), { status: 400 });
    }

    const user = await getUserFromToken(request);
    const deviceId = request.headers.get('X-Device-Id');

    // 检查管理员权限
    let isAdmin = false;
    if (user) {
      const check = await requirePermission(request, CHAT_LOG_VIEW);
      isAdmin = !('error' in check);
    }

    const session = await getSessionDetail({
      sessionId,
      userId: user?.id,
      deviceId: deviceId || undefined,
      isAdmin,
    });

    if (!session) {
      return NextResponse.json(errorResponse('会话不存在或无权访问'), { status: 404 });
    }

    return NextResponse.json(successResponse(session), {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('Get chat session detail error:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '获取会话详情失败'),
      { status: 500 },
    );
  }
}

/**
 * 删除会话（逻辑删除）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id, 10);

    if (isNaN(sessionId)) {
      return NextResponse.json(errorResponse('无效的会话ID'), { status: 400 });
    }

    const user = await getUserFromToken(request);
    const deviceId = request.headers.get('X-Device-Id');

    // 非管理员需要验证会话归属
    if (user) {
      const check = await requirePermission(request, CHAT_LOG_DELETE);
      const isAdmin = !('error' in check);

      if (!isAdmin) {
        const session = await getSessionDetail({
          sessionId,
          userId: user.id,
          isAdmin: false,
        });
        if (!session) {
          return NextResponse.json(errorResponse('会话不存在或无权删除'), { status: 404 });
        }
      }
    } else if (deviceId) {
      // 游客验证设备ID归属
      const session = await getSessionDetail({
        sessionId,
        deviceId,
        isAdmin: false,
      });
      if (!session) {
        return NextResponse.json(errorResponse('会话不存在或无权删除'), { status: 404 });
      }
    } else {
      return NextResponse.json(errorResponse('未登录且无设备标识'), { status: 401 });
    }

    await deleteSession(sessionId);

    return NextResponse.json(successResponse(null, '删除成功'));
  } catch (error) {
    console.error('Delete chat session error:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '删除会话失败'),
      { status: 500 },
    );
  }
}
