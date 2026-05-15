/**
 * 用户角色分配 API
 * GET /api/admin/users/[id]/roles - 获取用户角色
 * PUT /api/admin/users/[id]/roles - 设置用户角色
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/permission';
import { USER_VIEW, USER_ROLE_ASSIGN } from '@/constants/permissions';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { prisma } from '@/lib/prisma';
import { assignUserRoles, getUserRoles } from '@/services/permission';

// 设置用户角色验证 schema
const setUserRolesSchema = z.object({
  role_ids: z.array(z.number().int()).min(0, '角色列表'),
});

/**
 * 获取用户角色
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 权限检查
    const check = await requirePermission(request, USER_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json(errorResponse('无效的用户 ID'), { status: 400 });
    }

    // 检查用户是否存在
    const user = await prisma.tbUser.findUnique({
      where: { id: userId },
      select: { id: true, account: true, nickname: true, role: true },
    });

    if (!user) {
      return NextResponse.json(errorResponse('用户不存在'), { status: 404 });
    }

    // 获取用户角色
    const userRoles = await getUserRoles(userId);

    // 格式化返回数据
    const roles = userRoles.map(ur => ({
      id: ur.role.id,
      code: ur.role.code,
      name: ur.role.name,
      description: ur.role.description,
      status: ur.role.status,
    }));

    return NextResponse.json(
      successResponse({
        user: {
          id: user.id,
          account: user.account,
          nickname: user.nickname,
          role: user.role, // 旧角色字段
        },
        roles,
      })
    );
  } catch (error) {
    console.error('获取用户角色失败:', error);
    return NextResponse.json(errorResponse('获取用户角色失败'), { status: 500 });
  }
}

/**
 * 设置用户角色
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 权限检查
    const check = await requirePermission(request, USER_ROLE_ASSIGN);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json(errorResponse('无效的用户 ID'), { status: 400 });
    }

    // 检查用户是否存在
    const user = await prisma.tbUser.findUnique({
      where: { id: userId },
      select: { id: true, account: true, nickname: true },
    });

    if (!user) {
      return NextResponse.json(errorResponse('用户不存在'), { status: 404 });
    }

    const body = await request.json();

    // 使用 Zod 验证输入
    const validationResult = setUserRolesSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return NextResponse.json(
        errorResponse(`输入验证失败: ${errorMessages}`),
        { status: 400 }
      );
    }

    const { role_ids } = validationResult.data;

    // 检查角色是否存在
    if (role_ids.length > 0) {
      const roles = await prisma.tbRole.findMany({
        where: { id: { in: role_ids } },
        select: { id: true },
      });

      if (roles.length !== role_ids.length) {
        return NextResponse.json(errorResponse('部分角色不存在'), { status: 400 });
      }
    }

    // 设置用户角色
    await assignUserRoles(userId, role_ids);

    return NextResponse.json(successResponse(null, '用户角色更新成功'));
  } catch (error) {
    console.error('设置用户角色失败:', error);
    return NextResponse.json(errorResponse('设置用户角色失败'), { status: 500 });
  }
}
