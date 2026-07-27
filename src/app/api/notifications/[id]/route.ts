import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { markNotificationRead } from '@/services/notification';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json(errorResponse('未登录或登录已过期'), { status: 401 });
  const { id } = await params;
  const notificationId = Number(id);
  if (!Number.isInteger(notificationId) || notificationId <= 0) return NextResponse.json(errorResponse('通知 ID 无效'), { status: 400 });
  try {
    await markNotificationRead(user.id, notificationId);
    return NextResponse.json(successResponse(null, '已标记为已读'));
  } catch (error) {
    return NextResponse.json(errorResponse(error instanceof Error ? error.message : '更新通知失败'), { status: 404 });
  }
}
