import { NextRequest, NextResponse } from 'next/server';
import { verifyNotificationReadToken } from '@/lib/notification-unsubscribe';
import { markNotificationRead } from '@/services/notification';

const TRANSPARENT_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
  'base64',
);

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const payload = token ? verifyNotificationReadToken(token) : null;
  if (!payload) return new NextResponse('通知链接无效或已过期', { status: 400 });

  await markNotificationRead(payload.userId, payload.notificationId);

  if (request.nextUrl.searchParams.get('mode') === 'pixel') {
    return new NextResponse(TRANSPARENT_PIXEL, {
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, max-age=0' },
    });
  }

  return NextResponse.redirect(new URL(payload.targetUrl, request.url));
}
