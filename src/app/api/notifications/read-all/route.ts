import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { markAllNotificationsRead } from '@/services/notification';

export async function POST(request: NextRequest) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json(errorResponse('未登录或登录已过期'), { status: 401 });
  const result = await markAllNotificationsRead(user.id);
  return NextResponse.json(successResponse({ count: result.count }, '已全部标记为已读'));
}
