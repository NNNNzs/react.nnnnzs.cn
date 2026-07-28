/** PUT /api/user/email - 验证并绑定邮箱；DELETE - 解除邮箱绑定 */

import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, getUserFromToken, storeToken } from '@/lib/auth';
import { clearUserEmail, getUserSecurityState, updateVerifiedUserEmail } from '@/services/user';
import { errorResponse, successResponse } from '@/dto/response.dto';

const EMAIL_API = process.env.NEXT_PUBLIC_API_URL || 'https://api.nnnnzs.cn';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const noStoreHeaders = { 'Cache-Control': 'no-store', Pragma: 'no-cache' };

export async function PUT(request: NextRequest) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json(errorResponse('未登录或登录已过期'), { status: 401 });

  try {
    const { email, code } = await request.json() as { email?: unknown; code?: unknown };
    if (typeof email !== 'string' || email.length > 30 || !emailPattern.test(email)) {
      return NextResponse.json(errorResponse('请输入有效的邮箱地址'), { status: 400 });
    }
    const current = await getUserSecurityState(user.id);
    if (current?.mail === email && current.mail_verified_at) {
      return NextResponse.json(successResponse(user, '邮箱已验证，无需重复绑定'), { headers: noStoreHeaders });
    }
    if (typeof code !== 'string' || !code.trim()) {
      return NextResponse.json(errorResponse('请输入邮箱验证码'), { status: 400 });
    }

    const verifyResponse = await fetch(`${EMAIL_API}/email/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const verifyPayload = await verifyResponse.json() as { status?: boolean; message?: string };
    if (!verifyResponse.ok || !verifyPayload.status) {
      return NextResponse.json(errorResponse(verifyPayload.message || '邮箱验证码错误或已过期'), { status: 400 });
    }

    const result = await updateVerifiedUserEmail(user.id, email);
    const token = getTokenFromRequest(request.headers);
    if (token) await storeToken(token, result);
    return NextResponse.json(successResponse(result, '邮箱绑定成功'), { headers: noStoreHeaders });
  } catch (error) {
    console.error('绑定邮箱失败:', error);
    return NextResponse.json(errorResponse('绑定邮箱失败'), { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json(errorResponse('未登录或登录已过期'), { status: 401 });

  try {
    const result = await clearUserEmail(user.id);
    const token = getTokenFromRequest(request.headers);
    if (token) await storeToken(token, result);
    return NextResponse.json(successResponse(result, '邮箱已解绑'), { headers: noStoreHeaders });
  } catch (error) {
    console.error('解绑邮箱失败:', error);
    return NextResponse.json(errorResponse('解绑邮箱失败'), { status: 500 });
  }
}
