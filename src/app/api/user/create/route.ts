/**
 * 创建用户API
 * POST /api/user/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/services/user';
import {
  successResponse,
  errorResponse,
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { isAdmin } from '@/types/role';
import type { CreateUserDto } from '@/dto/user.dto';

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

    const body: CreateUserDto = await request.json();

    // 验证必填字段
    if (!body.account || !body.password || !body.nickname) {
      return NextResponse.json(errorResponse('账号、密码和昵称不能为空'), {
        status: 400,
      });
    }

    const result = await createUser(body);

    return NextResponse.json(successResponse(result, '创建成功'));
  } catch (error) {
    console.error('创建用户失败:', error);
    const errorMessage = error instanceof Error ? error.message : '创建用户失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
