/**
 * 权限码管理 API
 * GET /api/admin/permissions - 获取所有权限码列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission';
import { USER_VIEW } from '@/constants/permissions';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { prisma } from '@/lib/prisma';

/**
 * 获取所有权限码列表
 */
export async function GET(request: NextRequest) {
  try {
    // 权限检查
    const check = await requirePermission(request, USER_VIEW);
    if ('error' in check) {
      return NextResponse.json(errorResponse(check.error), { status: check.status });
    }

    const searchParams = request.nextUrl.searchParams;
    const moduleFilter = searchParams.get('module') || '';

    // 构建查询条件
    const where: Record<string, unknown> = {};
    if (moduleFilter) {
      where.module = moduleFilter;
    }

    // 查询权限码
    const permissions = await prisma.tbPermission.findMany({
      where,
      orderBy: [
        { module: 'asc' },
        { sort_order: 'asc' },
        { id: 'asc' },
      ],
    });

    // 按模块分组
    const groupedPermissions: Record<string, typeof permissions> = {};
    for (const perm of permissions) {
      if (!groupedPermissions[perm.module]) {
        groupedPermissions[perm.module] = [];
      }
      groupedPermissions[perm.module].push(perm);
    }

    return NextResponse.json(
      successResponse({
        list: permissions,
        grouped: groupedPermissions,
        modules: Object.keys(groupedPermissions),
      })
    );
  } catch (error) {
    console.error('获取权限码列表失败:', error);
    return NextResponse.json(errorResponse('获取权限码列表失败'), { status: 500 });
  }
}
