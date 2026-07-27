import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { errorResponse, successResponse } from '@/dto/response.dto';
import { notificationSettingsSchema } from '@/types/notification';
import { getNotificationSettings, updateNotificationSettings } from '@/services/notification';

export async function GET(request: NextRequest) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json(errorResponse('未登录或登录已过期'), { status: 401 });
  try {
    return NextResponse.json(successResponse(await getNotificationSettings(user.id)));
  } catch (error) {
    return NextResponse.json(errorResponse(error instanceof Error ? error.message : '获取通知设置失败'), { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json(errorResponse('未登录或登录已过期'), { status: 401 });
  try {
    const parsed = notificationSettingsSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json(errorResponse('通知设置格式无效'), { status: 400 });
    return NextResponse.json(successResponse(await updateNotificationSettings(user.id, parsed.data), '通知设置已更新'));
  } catch (error) {
    return NextResponse.json(errorResponse(error instanceof Error ? error.message : '更新通知设置失败'), { status: 500 });
  }
}
