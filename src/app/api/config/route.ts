/**
 * 创建配置API
 * POST /api/config
 */

import { NextRequest, NextResponse } from 'next/server';
import { createConfig } from '@/services/config';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { isAdmin } from '@/types/role';
import { successResponse, errorResponse } from '@/dto/response.dto';
export async function POST(request: NextRequest) {
  try {
    // 验证Token
    const token = getTokenFromRequest(request.headers);
    if (!token) {
      return NextResponse.json(errorResponse('未授权'), { status: 401 });
    }

    const user = await validateToken(token);
    if (!user) {
      return NextResponse.json(errorResponse('登录已过期'), { status: 401 });
    }

    // 检查是否是管理员
    if (!isAdmin(user.role)) {
      return NextResponse.json(errorResponse('无权限访问'), { status: 403 });
    }

    const body = await request.json();
    const result = await createConfig(body);

    return NextResponse.json(successResponse(result, '创建成功'));
  } catch (error) {
    console.error('创建配置失败:', error);
    const errorMessage = error instanceof Error ? error.message : '创建配置失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
