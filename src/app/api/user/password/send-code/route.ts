/** POST /api/user/password/send-code - 为无密码快捷登录用户发送初始化验证码 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getUserSecurityState } from '@/services/user';
import { errorResponse, successResponse } from '@/dto/response.dto';

const EMAIL_API = process.env.NEXT_PUBLIC_API_URL || 'https://api.nnnnzs.cn';

export async function POST(request: NextRequest) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json(errorResponse('未登录或登录已过期'), { status: 401 });

  try {
    const state = await getUserSecurityState(user.id);
    if (!state) return NextResponse.json(errorResponse('用户不存在'), { status: 404 });
    if (state.password) return NextResponse.json(errorResponse('该账号已设置登录密码'), { status: 400 });
    if (!state.mail || !state.mail_verified_at) {
      return NextResponse.json(errorResponse('请先绑定并验证邮箱'), { status: 400 });
    }
    const response = await fetch(`${EMAIL_API}/email/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.mail, purpose: 'set_password' }),
    });
    const payload = await response.json() as { status?: boolean; message?: string };
    if (!response.ok || !payload.status) {
      return NextResponse.json(errorResponse(payload.message || '验证码发送失败'), { status: 400 });
    }
    return NextResponse.json(successResponse(null, '验证码已发送，请查收邮箱'));
  } catch (error) {
    console.error('发送密码初始化验证码失败:', error);
    return NextResponse.json(errorResponse('邮箱验证服务暂不可用'), { status: 500 });
  }
}
