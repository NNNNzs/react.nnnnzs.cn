/**
 * 用户退出登录API
 * POST /api/user/logout
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTokenFromRequest,
  removeToken,
  TOKEN_KEY,
} from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';
export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request.headers);

    if (token) {
      removeToken(token);
    }

    const response = NextResponse.json(
      successResponse(null, '退出成功')
    );

    // 清除Cookie
    response.cookies.delete(TOKEN_KEY);

    return response;
  } catch (error) {
    console.error('退出登录失败:', error);
    return NextResponse.json(
      errorResponse('退出登录失败'),
      { status: 500 }
    );
  }
}

