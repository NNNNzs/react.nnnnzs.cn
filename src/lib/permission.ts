/**
 * 权限检查工具
 * 提供服务端权限验证功能
 */

import { validateToken, getTokenFromRequest } from '@/lib/auth';
import { isAdmin, hasPermission } from '@/types/role';
import type { User } from '@/types';
import type { RolePermissions } from '@/types/role';

/**
 * 从请求中验证用户身份和权限
 */
export async function validateUserFromRequest(
  headers: Headers
): Promise<{ user: User | null; error: string | null }> {
  const token = getTokenFromRequest(headers);

  if (!token) {
    return { user: null, error: '未授权' };
  }

  const user = await validateToken(token);

  if (!user) {
    return { user: null, error: '登录已过期' };
  }

  return { user, error: null };
}

/**
 * 检查用户是否有管理员权限
 */
export async function requireAdmin(
  headers: Headers
): Promise<{ user: User | null; error: string | null }> {
  const { user, error } = await validateUserFromRequest(headers);

  if (error) {
    return { user: null, error };
  }

  if (!user || !isAdmin(user.role)) {
    return { user: null, error: '无权限访问' };
  }

  return { user, error: null };
}

/**
 * 检查用户是否有指定权限
 */
export async function requirePermission(
  headers: Headers,
  permission: keyof RolePermissions
): Promise<{ user: User | null; error: string | null }> {
  const { user, error } = await validateUserFromRequest(headers);

  if (error) {
    return { user: null, error };
  }

  if (!user || !hasPermission(user.role, permission)) {
    return { user: null, error: '无权限访问' };
  }

  return { user, error: null };
}

/**
 * 创建权限中间件
 */
export function withPermission(permission: keyof RolePermissions) {
  return async (headers: Headers) => {
    return await requirePermission(headers, permission);
  };
}

/**
 * 创建管理员中间件
 */
export function withAdmin() {
  return async (headers: Headers) => {
    return await requireAdmin(headers);
  };
}
