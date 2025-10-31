/**
 * 获取用户信息API
 * GET /api/user/info
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  successResponse,
  errorResponse,
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request.headers);

    if (!token) {
      return NextResponse.json(
        errorResponse('未登录'),
        { status: 401 }
      );
    }

    const user = await validateToken(token);

    if (!user) {
      return NextResponse.json(
        errorResponse('Token无效或已过期'),
        { status: 401 }
      );
    }

    return NextResponse.json(successResponse(user));
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return NextResponse.json(
      errorResponse('获取用户信息失败'),
      { status: 500 }
    );
  }
}

