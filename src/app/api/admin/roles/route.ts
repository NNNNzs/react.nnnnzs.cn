/**
 * 角色管理 API
 * GET /api/admin/roles - 角色列表
 * POST /api/admin/roles - 创建角色
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/permission';
import { USER_VIEW, USER_MANAGE } from '@/constants/permissions';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { prisma } from '@/lib/prisma';

// 创建角色验证 schema
const createRoleSchema = z.object({
  code: z.string().min(1, '角色编码不能为空').max(50, '角色编码不能超过50个字符'),
  name: z.string().min(1, '角色名称不能为空').max(50, '角色名称不能超过50个字符'),
  description: z.string().max(255, '描述不能超过255个字符').optional().nullable(),
  status: z.number().int().min(0).max(1).optional(),
  sort_order: z.number().int().optional(),
});

/**
 * 获取角色列表
 */
export async function GET(request: NextRequest) {
  try {
    // 权限检查
    const check = await requirePermission(request, USER_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const searchParams = request.nextUrl.searchParams;
    const pageNum = Number(searchParams.get('pageNum')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 10;
    const query = searchParams.get('query') || '';

    // 构建查询条件
    const where: Record<string, unknown> = {};
    if (query) {
      where.OR = [
        { code: { contains: query } },
        { name: { contains: query } },
        { description: { contains: query } },
      ];
    }

    // 查询总数
    const total = await prisma.tbRole.count({ where });

    // 查询列表
    const roles = await prisma.tbRole.findMany({
      where,
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
      orderBy: [
        { sort_order: 'asc' },
        { id: 'asc' },
      ],
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    });

    // 格式化返回数据
    const formattedRoles = roles.map(role => ({
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
    }));

    return NextResponse.json(
      successResponse({
        record: formattedRoles,
        total,
        pageNum,
        pageSize,
      })
    );
  } catch (error) {
    console.error('获取角色列表失败:', error);
    return NextResponse.json(errorResponse('获取角色列表失败'), { status: 500 });
  }
}

/**
 * 创建角色
 */
export async function POST(request: NextRequest) {
  try {
    // 权限检查
    const check = await requirePermission(request, USER_MANAGE);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const body = await request.json();

    // 使用 Zod 验证输入
    const validationResult = createRoleSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return NextResponse.json(
        errorResponse(`输入验证失败: ${errorMessages}`),
        { status: 400 }
      );
    }

    const { code, name, description, status, sort_order } = validationResult.data;

    // 检查角色编码是否已存在
    const existingRole = await prisma.tbRole.findUnique({
      where: { code },
    });

    if (existingRole) {
      return NextResponse.json(errorResponse('角色编码已存在'), { status: 400 });
    }

    // 创建角色
    const role = await prisma.tbRole.create({
      data: {
        code,
        name,
        description,
        status: status ?? 1,
        sort_order: sort_order ?? 0,
      },
    });

    return NextResponse.json(successResponse(role, '创建成功'));
  } catch (error) {
    console.error('创建角色失败:', error);
    return NextResponse.json(errorResponse('创建角色失败'), { status: 500 });
  }
}
