/**
 * 创建用户API
 * POST /api/user/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/services/user';
import { requirePermission } from '@/lib/permission';
import { USER_MANAGE } from '@/constants/permissions';
import type { CreateUserDto } from '@/dto/user.dto';
import { successResponse, errorResponse } from '@/dto/response.dto';
export async function POST(request: NextRequest) {
  try {
    // 权限检查
    const check = await requirePermission(request, USER_MANAGE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
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
