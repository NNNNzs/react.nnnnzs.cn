/**
 * 用户角色枚举和类型定义
 */

/**
 * 用户角色枚举
 */
export enum UserRole {
  /** 管理员 - 拥有所有权限 */
  ADMIN = 'admin',
  /** 普通用户 - 基本权限 */
  USER = 'user',
  /** 游客 - 只读权限 */
  GUEST = 'guest',
}

/**
 * 角色显示名称映射
 */
export const RoleDisplayNames: Record<UserRole, string> = {
  [UserRole.ADMIN]: '管理员',
  [UserRole.USER]: '普通用户',
  [UserRole.GUEST]: '游客',
};

/**
 * 角色权限配置
 */
export interface RolePermissions {
  /** 可以访问配置管理 */
  canAccessConfig: boolean;
  /** 可以访问用户管理 */
  canAccessUserManagement: boolean;
  /** 可以创建文章 */
  canCreatePost: boolean;
  /** 可以编辑文章 */
  canEditPost: boolean;
  /** 可以删除文章 */
  canDeletePost: boolean;
  /** 可以管理评论 */
  canManageComments: boolean;
}

/**
 * 各角色权限映射
 */
export const RolePermissionsMap: Record<UserRole, RolePermissions> = {
  [UserRole.ADMIN]: {
    canAccessConfig: true,
    canAccessUserManagement: true,
    canCreatePost: true,
    canEditPost: true,
    canDeletePost: true,
    canManageComments: true,
  },
  [UserRole.USER]: {
    canAccessConfig: false,
    canAccessUserManagement: false,
    canCreatePost: true,
    canEditPost: true,
    canDeletePost: false,
    canManageComments: false,
  },
  [UserRole.GUEST]: {
    canAccessConfig: false,
    canAccessUserManagement: false,
    canCreatePost: false,
    canEditPost: false,
    canDeletePost: false,
    canManageComments: false,
  },
};

/**
 * 检查用户是否有指定权限
 */
export function hasPermission(
  userRole: string | null | undefined,
  permission: keyof RolePermissions
): boolean {
  if (!userRole) {
    return false;
  }

  const role = userRole as UserRole;
  const permissions = RolePermissionsMap[role];

  if (!permissions) {
    return false;
  }

  return permissions[permission];
}

/**
 * 检查用户是否是管理员
 */
export function isAdmin(userRole: string | null | undefined): boolean {
  return userRole === UserRole.ADMIN;
}

/**
 * 获取所有角色选项（用于下拉选择）
 */
export function getRoleOptions() {
  return Object.values(UserRole).map((role) => ({
    label: RoleDisplayNames[role],
    value: role,
  }));
}
