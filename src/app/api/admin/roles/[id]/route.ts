/**
 * 角色详情、更新、删除 API
 * GET /api/admin/roles/[id] - 角色详情
 * PUT /api/admin/roles/[id] - 更新角色
 * DELETE /api/admin/roles/[id] - 删除角色
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/permission';
import { USER_VIEW, USER_MANAGE } from '@/constants/permissions';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { prisma } from '@/lib/prisma';

// 更新角色验证 schema
const updateRoleSchema = z.object({
  name: z.string().min(1, '角色名称不能为空').max(50, '角色名称不能超过50个字符').optional(),
  description: z.string().max(255, '描述不能超过255个字符').optional().nullable(),
  status: z.number().int().min(0).max(1).optional(),
  sort_order: z.number().int().optional(),
});

/**
 * 获取角色详情
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

    const role = await prisma.tbRole.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: {
            permission: {
              select: {
                id: true,
                code: true,
                name: true,
                module: true,
                type: true,
              },
            },
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    if (!role) {
      return NextResponse.json(errorResponse('角色不存在'), { status: 404 });
    }

    // 格式化返回数据
    const formattedRole = {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      status: role.status,
      sort_order: role.sort_order,
      user_count: role._count.users,
      permissions: role.permissions.map(rp => ({
        id: rp.permission.id,
        code: rp.permission.code,
        name: rp.permission.name,
        module: rp.permission.module,
        type: rp.permission.type,
        data_scope: rp.data_scope,
      })),
      created_at: role.created_at,
      updated_at: role.updated_at,
    };

    return NextResponse.json(successResponse(formattedRole));
  } catch (error) {
    console.error('获取角色详情失败:', error);
    return NextResponse.json(errorResponse('获取角色详情失败'), { status: 500 });
  }
}

/**
 * 更新角色
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 权限检查
    const check = await requirePermission(request, USER_MANAGE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id } = await params;
    const roleId = parseInt(id, 10);

    if (isNaN(roleId)) {
      return NextResponse.json(errorResponse('无效的角色 ID'), { status: 400 });
    }

    // 检查角色是否存在
    const existingRole = await prisma.tbRole.findUnique({
      where: { id: roleId },
    });

    if (!existingRole) {
      return NextResponse.json(errorResponse('角色不存在'), { status: 404 });
    }

    const body = await request.json();

    // 使用 Zod 验证输入
    const validationResult = updateRoleSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return NextResponse.json(
        errorResponse(`输入验证失败: ${errorMessages}`),
        { status: 400 }
      );
    }

    // 更新角色
    const role = await prisma.tbRole.update({
      where: { id: roleId },
      data: validationResult.data,
    });

    return NextResponse.json(successResponse(role, '更新成功'));
  } catch (error) {
    console.error('更新角色失败:', error);
    return NextResponse.json(errorResponse('更新角色失败'), { status: 500 });
  }
}

/**
 * 删除角色
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 权限检查
    const check = await requirePermission(request, USER_MANAGE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const { id } = await params;
    const roleId = parseInt(id, 10);

    if (isNaN(roleId)) {
      return NextResponse.json(errorResponse('无效的角色 ID'), { status: 400 });
    }

    // 检查角色是否存在
    const existingRole = await prisma.tbRole.findUnique({
      where: { id: roleId },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!existingRole) {
      return NextResponse.json(errorResponse('角色不存在'), { status: 404 });
    }

    // 不允许删除系统内置角色
    if (['admin', 'user'].includes(existingRole.code)) {
      return NextResponse.json(errorResponse('系统内置角色不允许删除'), { status: 400 });
    }

    // 检查是否有用户使用此角色
    if (existingRole._count.users > 0) {
      return NextResponse.json(
        errorResponse(`该角色下还有 ${existingRole._count.users} 个用户，请先移除用户的角色`),
        { status: 400 }
      );
    }

    // 删除角色（关联的权限会自动删除，因为设置了 onDelete: Cascade）
    await prisma.tbRole.delete({
      where: { id: roleId },
    });

    return NextResponse.json(successResponse(null, '删除成功'));
  } catch (error) {
    console.error('删除角色失败:', error);
    return NextResponse.json(errorResponse('删除角色失败'), { status: 500 });
  }
}
