/**
 * 用户详情、更新、删除API
 * GET /api/user/[id]
 * PUT /api/user/[id]
 * DELETE /api/user/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUser, deleteUser } from '@/services/user';
import { hasPermissionCode, requireAuth, requirePermission } from '@/lib/permission';
import { USER_MANAGE, USER_ROLE_ASSIGN, USER_VIEW } from '@/constants/permissions';
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
    // 权限检查
    const check = await requirePermission(request, USER_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
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
    const check = await requireAuth(request);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id } = await context.params;
    const body: UpdateUserDto = await request.json();

    const hasRoleUpdate = body.role_ids !== undefined;
    const hasBaseUpdate = ['nickname', 'mail', 'phone', 'avatar', 'status', 'password']
      .some((key) => body[key as keyof UpdateUserDto] !== undefined);
    if (!hasRoleUpdate && !hasBaseUpdate) {
      return NextResponse.json(errorResponse('没有可更新的字段'), { status: 400 });
    }
    if (body.role_ids !== undefined && (
      !Array.isArray(body.role_ids)
      || body.role_ids.length === 0
      || body.role_ids.some((roleId) => !Number.isInteger(roleId) || roleId <= 0)
    )) {
      return NextResponse.json(errorResponse('role_ids 必须是非空正整数数组'), { status: 400 });
    }
    if (hasBaseUpdate && !hasPermissionCode(check.user, USER_MANAGE)) {
      return NextResponse.json(errorResponse(`无权限执行此操作（需要 ${USER_MANAGE}）`), { status: 403 });
    }
    if (hasRoleUpdate && !hasPermissionCode(check.user, USER_ROLE_ASSIGN)) {
      return NextResponse.json(errorResponse(`无权限执行此操作（需要 ${USER_ROLE_ASSIGN}）`), { status: 403 });
    }

    const result = await updateUser(Number(id), body);

    return NextResponse.json(successResponse(result, '更新成功'));
  } catch (error) {
    console.error('更新用户失败:', error);
    const errorMessage = error instanceof Error ? error.message : '更新用户失败';
    const status = errorMessage.includes('角色') || errorMessage.includes('管理员') ? 400 : 500;
    return NextResponse.json(errorResponse(errorMessage), { status });
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
    // 权限检查
    const check = await requirePermission(request, USER_MANAGE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id } = await context.params;

    await deleteUser(Number(id));

    return NextResponse.json(successResponse(null, '删除成功'));
  } catch (error) {
    console.error('删除用户失败:', error);
    const errorMessage = error instanceof Error ? error.message : '删除用户失败';
    const status = errorMessage.includes('管理员') ? 400 : 500;
    return NextResponse.json(errorResponse(errorMessage), { status });
  }
}
