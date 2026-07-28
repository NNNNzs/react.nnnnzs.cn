/** POST /api/user/email/send-code - 为当前登录用户发送邮箱绑定验证码 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { errorResponse, successResponse } from '@/dto/response.dto';

const EMAIL_API = process.env.NEXT_PUBLIC_API_URL || 'https://api.nnnnzs.cn';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json(errorResponse('未登录或登录已过期'), { status: 401 });

  try {
    const { email } = await request.json() as { email?: unknown };
    if (typeof email !== 'string' || email.length > 30 || !emailPattern.test(email)) {
      return NextResponse.json(errorResponse('请输入有效的邮箱地址'), { status: 400 });
    }

    const response = await fetch(`${EMAIL_API}/email/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, purpose: 'bind_email' }),
    });
    const payload = await response.json() as { status?: boolean; message?: string };
    if (!response.ok || !payload.status) {
      return NextResponse.json(errorResponse(payload.message || '验证码发送失败'), { status: 400 });
    }
    return NextResponse.json(successResponse(null, '验证码已发送，请查收邮箱'), {
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    });
  } catch (error) {
    console.error('发送邮箱绑定验证码失败:', error);
    return NextResponse.json(errorResponse('邮箱验证服务暂不可用'), { status: 500 });
  }
}
