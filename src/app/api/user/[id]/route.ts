/**
 * 用户详情、更新、删除API
 * GET /api/user/[id]
 * PUT /api/user/[id]
 * DELETE /api/user/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserById,
  updateUser,
  deleteUser,
} from '@/services/user';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import { isAdmin } from '@/types/role';
import type { UpdateUserDto } from '@/dto/user.dto';
import { successResponse, errorResponse } from '@/dto/response.dto';
/**
 * 获取用户详情
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params;

    const targetUser = await getUserById(Number(id));

    if (!targetUser) {
      return NextResponse.json(errorResponse('用户不存在'), { status: 404 });
    }

    return NextResponse.json(successResponse(targetUser));
  } catch (error) {
    console.error('获取用户详情失败:', error);
    return NextResponse.json(errorResponse('获取用户详情失败'), {
      status: 500,
    });
  }
}

/**
 * 更新用户
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params;
    const body: UpdateUserDto = await request.json();

    const result = await updateUser(Number(id), body);

    return NextResponse.json(successResponse(result, '更新成功'));
  } catch (error) {
    console.error('更新用户失败:', error);
    const errorMessage = error instanceof Error ? error.message : '更新用户失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}

/**
 * 删除用户
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params;

    await deleteUser(Number(id));

    return NextResponse.json(successResponse(null, '删除成功'));
  } catch (error) {
    console.error('删除用户失败:', error);
    const errorMessage = error instanceof Error ? error.message : '删除用户失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
