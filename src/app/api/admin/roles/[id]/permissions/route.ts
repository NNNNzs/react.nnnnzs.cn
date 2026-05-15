/**
 * 角色权限管理 API
 * GET /api/admin/roles/[id]/permissions - 获取角色权限列表
 * PUT /api/admin/roles/[id]/permissions - 设置角色权限
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/permission';
import { USER_VIEW, USER_ROLE_ASSIGN } from '@/constants/permissions';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { prisma } from '@/lib/prisma';

// 设置角色权限验证 schema
const setRolePermissionsSchema = z.object({
  permissions: z.array(z.object({
    code: z.string().min(1, '权限码不能为空'),
    data_scope: z.enum(['self', 'all']).default('self'),
  })).min(0, '权限列表'),
});

/**
 * 获取角色权限列表
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
    const roleId = parseInt(id, 10);

    if (isNaN(roleId)) {
      return NextResponse.json(errorResponse('无效的角色 ID'), { status: 400 });
    }

    // 检查角色是否存在
    const role = await prisma.tbRole.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return NextResponse.json(errorResponse('角色不存在'), { status: 404 });
    }

    // 获取角色权限
    const rolePermissions = await prisma.tbRolePermission.findMany({
      where: { role_id: roleId },
      include: {
        permission: {
          select: {
            id: true,
            code: true,
            name: true,
            module: true,
            type: true,
            description: true,
          },
        },
      },
      orderBy: {
        permission: {
          sort_order: 'asc',
        },
      },
    });

    // 格式化返回数据
    const permissions = rolePermissions.map(rp => ({
      id: rp.permission.id,
      code: rp.permission.code,
      name: rp.permission.name,
      module: rp.permission.module,
      type: rp.permission.type,
      description: rp.permission.description,
      data_scope: rp.data_scope,
    }));

    return NextResponse.json(
      successResponse({
        role: {
          id: role.id,
          code: role.code,
          name: role.name,
        },
        permissions,
      })
    );
  } catch (error) {
    console.error('获取角色权限失败:', error);
    return NextResponse.json(errorResponse('获取角色权限失败'), { status: 500 });
  }
}

/**
 * 设置角色权限（全量替换）
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
    const roleId = parseInt(id, 10);

    if (isNaN(roleId)) {
      return NextResponse.json(errorResponse('无效的角色 ID'), { status: 400 });
    }

    // 检查角色是否存在
    const role = await prisma.tbRole.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return NextResponse.json(errorResponse('角色不存在'), { status: 404 });
    }

    const body = await request.json();

    // 使用 Zod 验证输入
    const validationResult = setRolePermissionsSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return NextResponse.json(
        errorResponse(`输入验证失败: ${errorMessages}`),
        { status: 400 }
      );
    }

    const { permissions } = validationResult.data;

    // 使用事务确保原子性
    await prisma.$transaction(async (tx) => {
      // 删除旧的权限关联
      await tx.tbRolePermission.deleteMany({
        where: { role_id: roleId },
      });

      // 创建新的权限关联
      if (permissions.length > 0) {
        // 查询权限 ID
        const permissionCodes = permissions.map(p => p.code);
        const permissionRecords = await tx.tbPermission.findMany({
          where: { code: { in: permissionCodes } },
          select: { id: true, code: true },
        });

        const permissionMap = new Map(permissionRecords.map(p => [p.code, p.id]));

        // 创建关联
        const rolePermissions = permissions
          .filter(p => permissionMap.has(p.code))
          .map(p => ({
            role_id: roleId,
            permission_id: permissionMap.get(p.code)!,
            data_scope: p.data_scope,
          }));

        if (rolePermissions.length > 0) {
          await tx.tbRolePermission.createMany({
            data: rolePermissions,
          });
        }
      }
    });

    return NextResponse.json(successResponse(null, '角色权限更新成功'));
  } catch (error) {
    console.error('设置角色权限失败:', error);
    return NextResponse.json(errorResponse('设置角色权限失败'), { status: 500 });
  }
}
