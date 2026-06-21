/**
 * 获取当前用户权限信息
 * GET /api/auth/permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthUserFromRequest,
  getTokenFromRequest,
  setAuthCookie,
} from '@/lib/auth';
import { successResponse, errorResponse } from '@/dto/response.dto';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request.headers);

    if (!user) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const response = NextResponse.json(
      successResponse({
        permissions: user.permissions,
        dataScopes: user.dataScopes,
      })
    );
    const token = getTokenFromRequest(request.headers);
    if (token) {
      setAuthCookie(response, token);
    }
    return response;
  } catch (error) {
    console.error('获取权限信息失败:', error);
    return NextResponse.json(errorResponse('获取权限信息失败'), { status: 500 });
  }
}
