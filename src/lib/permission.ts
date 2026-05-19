/**
 * 权限检查工具
 * 提供服务端权限验证功能
 */

import { validateToken, getTokenFromRequest, getAuthUserFromRequest } from '@/lib/auth';
import { hasPermission } from '@/types/role';
import {
  POST_VIEW,
  POST_EDIT,
  POST_DELETE,
  POST_VIEW_DELETED,
  COLLECTION_EDIT,
  CONFIG_VIEW,
  CONFIG_EDIT,
  USER_MANAGE,
} from '@/constants/permissions';
import type { User } from '@/types';
import type { AuthUser } from '@/types/auth';
import type { RolePermissions } from '@/types/role';
import type { SerializedPost } from '@/dto/post.dto';
import type { NextRequest } from 'next/server';

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
 * @deprecated 请使用 requirePermission(request, specificCode) 替代
 */
export async function requireAdmin(
  headers: Headers
): Promise<{ user: AuthUser | null; error: string | null }> {
  const user = await getAuthUserFromRequest(headers);

  if (!user) {
    return { user: null, error: '未授权' };
  }

  if (!hasPermissionCode(user, CONFIG_VIEW)) {
    return { user: null, error: '无权限访问' };
  }

  return { user, error: null };
}

/**
 * 检查用户是否有指定权限（旧版本，兼容保留）
 */
export async function requirePermissionLegacy(
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
 * 创建权限中间件（旧版本，兼容保留）
 */
export function withPermission(permission: keyof RolePermissions) {
  return async (headers: Headers) => {
    return await requirePermissionLegacy(headers, permission);
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

// ============ 文章级别权限检查 ============

/** 文章操作 → 权限码映射 */
const POST_OPERATION_PERMISSIONS: Record<string, string> = {
  read: POST_VIEW,
  edit: POST_EDIT,
  delete: POST_DELETE,
};

/**
 * 检查用户是否有权限操作指定文章
 * @param user 当前用户（AuthUser）
 * @param post 目标文章
 * @param operation 操作类型：'read' | 'edit' | 'delete'
 * @returns 是否有权限
 */
export function canAccessPost(
  user: AuthUser | null,
  post: SerializedPost,
  operation: 'read' | 'edit' | 'delete'
): boolean {
  const permissionCode = POST_OPERATION_PERMISSIONS[operation];

  // 拥有对应操作的全部数据权限（如管理员 scope=all）
  if (user && hasDataPermission(user, permissionCode)) {
    return true;
  }

  // 未登录用户只能阅读公开文章
  if (!user) {
    return operation === 'read';
  }

  // 拥有对应操作的自有数据权限，且是文章作者
  if (hasDataPermission(user, permissionCode, post.created_by)) {
    return true;
  }

  return false;
}

/**
 * 检查用户是否有权限查看隐藏文章
 * @param user 当前用户
 * @returns 是否有权限
 */
export function canViewHiddenPosts(user: AuthUser | null): boolean {
  return !!user && hasPermissionCode(user, POST_VIEW_DELETED);
}

/**
 * 检查用户是否可以查看所有文章列表
 * @param user 当前用户
 * @returns 是否有权限
 */
export function canViewAllPosts(user: AuthUser | null): boolean {
  return !!user && hasDataPermission(user, POST_VIEW);
}

// ============ 用户级别权限检查 ============

/**
 * 检查用户是否有权限操作指定用户的信息
 * @param currentUser 当前用户
 * @param targetUserId 目标用户ID
 * @param operation 操作类型：'read' | 'edit' | 'delete'
 * @returns 是否有权限
 */
export function canAccessUser(
  currentUser: AuthUser | null,
  targetUserId: number,
  operation: 'read' | 'edit' | 'delete'
): boolean {
  // 拥有用户管理全部数据权限（管理员）
  if (currentUser && hasDataPermission(currentUser, USER_MANAGE)) {
    return true;
  }

  // 未登录用户无权限
  if (!currentUser) {
    return false;
  }

  // 用户只能操作自己的信息（查看和编辑）
  if (currentUser.id !== targetUserId) {
    return false;
  }

  // 用户可以查看和编辑自己的信息
  if (operation === 'read' || operation === 'edit') {
    return true;
  }

  // 用户不能删除自己
  return false;
}

/**
 * 检查用户是否有权限管理系统配置
 * @param user 当前用户
 * @returns 是否有权限
 */
export function canManageConfig(user: AuthUser | null): boolean {
  return !!user && hasPermissionCode(user, CONFIG_EDIT);
}

/**
 * 检查用户是否有权限管理合集
 * @param user 当前用户
 * @returns 是否有权限
 */
export function canManageCollections(user: AuthUser | null): boolean {
  return !!user && hasPermissionCode(user, COLLECTION_EDIT);
}

/**
 * 检查用户是否有权限管理用户
 * @param user 当前用户
 * @returns 是否有权限
 */
export function canManageUsers(user: AuthUser | null): boolean {
  return !!user && hasPermissionCode(user, USER_MANAGE);
}

// ============ API 响应辅助函数 ============

/**
 * 返回未授权响应
 */
export function unauthorizedResponse(message: string = '未授权') {
  return { error: message, status: 401 };
}

/**
 * 返回禁止访问响应
 */
export function forbiddenResponse(message: string = '无权限访问') {
  return { error: message, status: 403 };
}

/**
 * 返回成功响应（包含数据）
 */
export function successDataResponse<T>(data: T, message?: string) {
  return { data, message, status: 200 };
}

// ============ 新版 RBAC 权限检查 ============

/**
 * 检查用户是否有指定权限码
 *
 * @param user AuthUser 对象
 * @param code 权限码
 * @returns 是否有权限
 */
export function hasPermissionCode(user: AuthUser, code: string): boolean {
  return user.permissions.includes(code);
}

/**
 * 检查用户是否有指定权限码 + 数据权限
 *
 * @param user AuthUser 对象
 * @param code 权限码
 * @param resourceOwnerId 资源所有者 ID（用于数据权限检查）
 * @returns 是否有权限
 */
export function hasDataPermission(
  user: AuthUser,
  code: string,
  resourceOwnerId?: number | null
): boolean {
  const scope = user.dataScopes[code];
  if (!scope) return false;

  // 仅接受合法的 data_scope 值
  if (scope === 'all') return true;
  if (scope === 'self') {
    return resourceOwnerId != null && resourceOwnerId === user.id;
  }

  // 非法值视为无权限
  return false;
}

/**
 * API 路由快捷方法：需要指定权限
 *
 * @param request NextRequest 对象
 * @param code 权限码
 * @returns AuthUser 或错误信息
 */
export async function requirePermission(
  request: NextRequest,
  code: string
): Promise<{ user: AuthUser } | { error: string; status: number }> {
  const user = await getAuthUserFromRequest(request.headers);
  if (!user) {
    return { error: '未授权', status: 401 };
  }

  if (!hasPermissionCode(user, code)) {
    return { error: `无权限执行此操作（需要 ${code}）`, status: 403 };
  }

  return { user };
}

/**
 * API 路由快捷方法：需要认证（不限制权限）
 *
 * @param request NextRequest 对象
 * @returns AuthUser 或错误信息
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ user: AuthUser } | { error: string; status: number }> {
  const user = await getAuthUserFromRequest(request.headers);
  if (!user) {
    return { error: '未授权', status: 401 };
  }

  return { user };
}
