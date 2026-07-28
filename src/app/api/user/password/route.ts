/** PUT /api/user/password - 修改或初始化当前用户的登录密码 */

import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, getUserFromToken, storeToken, verifyPassword } from '@/lib/auth';
import { getUserSecurityState, updateUser } from '@/services/user';
import { errorResponse, successResponse } from '@/dto/response.dto';

const EMAIL_API = process.env.NEXT_PUBLIC_API_URL || 'https://api.nnnnzs.cn';
const noStoreHeaders = { 'Cache-Control': 'no-store', Pragma: 'no-cache' };

export async function PUT(request: NextRequest) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json(errorResponse('未登录或登录已过期'), { status: 401 });

  try {
    const { newPassword, currentPassword, emailCode } = await request.json() as {
      newPassword?: unknown;
      currentPassword?: unknown;
      emailCode?: unknown;
    };
    if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 20) {
      return NextResponse.json(errorResponse('密码长度需为 6 到 20 个字符'), { status: 400 });
    }

    const state = await getUserSecurityState(user.id);
    if (!state) return NextResponse.json(errorResponse('用户不存在'), { status: 404 });

    if (state.password) {
      if (typeof currentPassword !== 'string' || !await verifyPassword(currentPassword, state.password)) {
        return NextResponse.json(errorResponse('当前密码不正确'), { status: 400 });
      }
    } else {
      if (!state.mail || !state.mail_verified_at) {
        return NextResponse.json(errorResponse('快捷登录账号请先绑定并验证邮箱，再设置登录密码'), { status: 400 });
      }
      if (typeof emailCode !== 'string' || !emailCode.trim()) {
        return NextResponse.json(errorResponse('请输入邮箱验证码'), { status: 400 });
      }
      const verifyResponse = await fetch(`${EMAIL_API}/email/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: state.mail, code: emailCode }),
      });
      const verifyPayload = await verifyResponse.json() as { status?: boolean; message?: string };
      if (!verifyResponse.ok || !verifyPayload.status) {
        return NextResponse.json(errorResponse(verifyPayload.message || '邮箱验证码错误或已过期'), { status: 400 });
      }
    }

    const result = await updateUser(user.id, { password: newPassword });
    const token = getTokenFromRequest(request.headers);
    if (token) await storeToken(token, result);
    return NextResponse.json(successResponse(result, state.password ? '密码修改成功' : '登录密码设置成功'), {
      headers: noStoreHeaders,
    });
  } catch (error) {
    console.error('更新密码失败:', error);
    return NextResponse.json(errorResponse('更新密码失败'), { status: 500 });
  }
}
