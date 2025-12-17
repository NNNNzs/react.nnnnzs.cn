/**
 * 用户登录API
 * POST /api/user/login
 */

import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/services/auth';
import {
  TOKEN_KEY,
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
    response.cookies.set(TOKEN_KEY, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7天
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('登录失败:', error);
    return NextResponse.json(errorResponse('登录失败'), { status: 500 });
  }
}
