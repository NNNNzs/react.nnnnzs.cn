import { NextRequest, NextResponse } from 'next/server';
import { verifyUnsubscribeToken } from '@/lib/notification-unsubscribe';
import { getNotificationSettings, updateNotificationSettings } from '@/services/notification';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const payload = token ? verifyUnsubscribeToken(token) : null;
  if (!payload) return new NextResponse('退订链接无效或已过期', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const notificationName = payload.type === 'COMMENT_ON_POST' ? '文章评论' : '评论回复';
  const escapedToken = (token || '').replace(/&/g, '&amp;').replace(/\"/g, '&quot;');
  return new NextResponse(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>确认退订</title></head><body style="font-family:system-ui,-apple-system,sans-serif;margin:0;background:#f8fafc;color:#0f172a"><main style="max-width:480px;margin:12vh auto;padding:32px;background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,.1)"><h1 style="font-size:20px">确认关闭邮件提醒</h1><p>关闭后，你将不再收到“${notificationName}”的邮件提醒，站内通知不受影响。</p><form method="post"><input type="hidden" name="token" value="${escapedToken}"><button type="submit" style="border:0;border-radius:6px;padding:10px 16px;background:#2563eb;color:#fff;cursor:pointer">确认退订</button></form><p style="margin-top:20px"><a href="/c/user/info">前往个人设置管理全部通知</a></p></main></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = form.get('token');
  const payload = typeof token === 'string' ? verifyUnsubscribeToken(token) : null;
  if (!payload) return new NextResponse('退订链接无效或已过期', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const settings = await getNotificationSettings(payload.userId);
  const key = payload.type === 'COMMENT_ON_POST' ? 'postComment' : 'commentReply';
  settings.email[key] = false;
  await updateNotificationSettings(payload.userId, settings);
  return new NextResponse('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>退订成功</title></head><body style="font-family:system-ui,-apple-system,sans-serif;margin:0;background:#f8fafc;color:#0f172a"><main style="max-width:480px;margin:12vh auto;padding:32px;background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,.1)"><h1 style="font-size:20px">已关闭此类邮件提醒</h1><p>你仍可在站内通知中心查看互动消息。</p><p><a href="/c/user/info">前往个人设置</a></p></main></body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
