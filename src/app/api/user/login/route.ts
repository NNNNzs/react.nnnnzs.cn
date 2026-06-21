/**
 * 用户登录API
 * POST /api/user/login
 */

import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/services/auth';
import {
  setAuthCookie,
} from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account, password } = body;

    if (!account || !password) {
      return NextResponse.json(errorResponse('账号和密码不能为空'), {
        status: 400,
      });
    }

    const result = await login(account, password);

    if (!result) {
      return NextResponse.json(errorResponse('账号或密码错误'), {
        status: 401,
      });
    }

    const { token, userInfo } = result;

    const response = NextResponse.json(
      successResponse({ token, userInfo }, '登录成功')
    );

    // 设置Cookie
    setAuthCookie(response, token);

    return response;
  } catch (error) {
    console.error('登录失败:', error);
    return NextResponse.json(errorResponse('登录失败'), { status: 500 });
  }
}
