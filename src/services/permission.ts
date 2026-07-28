/**
 * 权限查询服务
 *
 * 角色与权限唯一来自 TbUserRole -> TbRolePermission -> TbPermission。
 */

import { prisma } from '@/lib/prisma';

/**
 * 用户权限信息
 */
export interface UserPermissions {
  permissions: string[];
  dataScopes: Record<string, string>;
}

/**
 * 从 RBAC 表查询用户权限
 *
 * @param userId 用户 ID
 * @returns 用户权限列表和数据权限范围
 */
export async function getUserPermissions(userId: number): Promise<UserPermissions> {
  // 先查询用户的角色
  const userRoles = await prisma.tbUserRole.findMany({
    where: {
      user_id: userId,
      role: { status: 1 }, // 只取启用的角色
    },
    select: {
      role_id: true,
    },
  });

  if (userRoles.length === 0) {
    return { permissions: [], dataScopes: {} };
  }

  // 查询角色权限
  const rolePermissions = await prisma.tbRolePermission.findMany({
    where: {
      role_id: { in: userRoles.map(ur => ur.role_id) },
      permission: { status: 1 }, // 只取启用的权限
    },
    include: {
      permission: {
        select: {
          code: true,
        },
      },
    },
  });

  const permissions: string[] = [];
  const dataScopes: Record<string, string> = {};

  for (const rp of rolePermissions) {
    if (rp.permission) {
      permissions.push(rp.permission.code);
      // 同一权限多个角色时，取范围最大的（all > self）
      const existing = dataScopes[rp.permission.code];
      if (!existing || rp.data_scope === 'all') {
        dataScopes[rp.permission.code] = rp.data_scope;
      }
    }
  }

  return {
    permissions: [...new Set(permissions)],
    dataScopes,
  };
}

/**
 * 解析用户权限
 *
 * @param user 用户标识
 * @returns 用户权限列表和数据权限范围
 */
export async function resolveUserPermissions(user: { id: number }): Promise<UserPermissions> {
  return getUserPermissions(user.id);
}
