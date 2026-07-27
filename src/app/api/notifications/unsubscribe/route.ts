import { NextRequest, NextResponse } from 'next/server';
import { verifyUnsubscribeToken } from '@/lib/notification-unsubscribe';
import { getNotificationSettings, updateNotificationSettings } from '@/services/notification';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const payload = token ? verifyUnsubscribeToken(token) : null;
  if (!payload) return new NextResponse('退订链接无效或已过期', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const settings = await getNotificationSettings(payload.userId);
  const key = payload.type === 'COMMENT_ON_POST' ? 'postComment' : 'commentReply';
  settings.email[key] = false;
  await updateNotificationSettings(payload.userId, settings);
  return new NextResponse('已关闭此类邮件通知。你仍可在站内通知中心查看消息。', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
