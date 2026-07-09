/**
 * 权限查询服务
 *
 * 提供用户权限查询功能，支持：
 * 1. 从新 RBAC 表查询权限（TbUserRole -> TbRolePermission -> TbPermission）
 * 2. 兼容旧的 role 字段（过渡期）
 */

import { prisma } from '@/lib/prisma';
import {
  POST_VIEW, POST_CREATE, POST_EDIT, POST_HIDE,
} from '@/constants/permissions';

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
 * 解析用户权限（兼容层）
 *
 * 优先从新表查询，如果没有则回退到旧逻辑
 *
 * @param user 用户信息（包含 id 和 role）
 * @returns 用户权限列表和数据权限范围
 */
export async function resolveUserPermissions(user: {
  id: number;
  role: string | null;
}): Promise<UserPermissions> {
  // 优先从新表查询
  const userRoles = await prisma.tbUserRole.findMany({
    where: { user_id: user.id },
    select: { role_id: true },
  });

  // 关键：通过用户是否有角色关联来判断使用新/旧权限系统
  // 不能用 permissions.length 判断，因为用户可能有角色但角色没有权限
  if (userRoles.length > 0) {
    return getUserPermissions(user.id);
  }

  // 回退到旧逻辑（仅当用户没有 tb_user_role 记录时）
  if (user.role === 'admin') {
    const permissions = await prisma.tbPermission.findMany({
      where: { status: 1 },
      select: { code: true },
    });
    const permissionCodes = permissions.map(p => p.code);
    return {
      permissions: permissionCodes,
      dataScopes: Object.fromEntries(permissionCodes.map(c => [c, 'all'])),
    };
  }

  if (user.role === 'user') {
    return {
      permissions: [POST_VIEW, POST_CREATE, POST_EDIT, POST_HIDE],
      dataScopes: {
        [POST_VIEW]: 'self',
        [POST_CREATE]: 'self',
        [POST_EDIT]: 'self',
        [POST_HIDE]: 'self',
      },
    };
  }

  // guest 或未知角色
  return { permissions: [], dataScopes: {} };
}

/**
 * 为用户分配角色
 *
 * @param userId 用户 ID
 * @param roleIds 角色 ID 列表
 */
export async function assignUserRoles(userId: number, roleIds: number[]) {
  // 删除旧的角色关联
  await prisma.tbUserRole.deleteMany({
    where: { user_id: userId },
  });

  // 创建新的角色关联
  if (roleIds.length > 0) {
    await prisma.tbUserRole.createMany({
      data: roleIds.map(roleId => ({
        user_id: userId,
        role_id: roleId,
      })),
    });
  }
}

/**
 * 获取用户当前角色
 *
 * @param userId 用户 ID
 * @returns 角色列表
 */
export async function getUserRoles(userId: number) {
  return prisma.tbUserRole.findMany({
    where: { user_id: userId },
    include: {
      role: {
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          status: true,
        },
      },
    },
  });
}
