import {
  CDN_PURGE_VIEW,
  USER_MANAGE,
  USER_ROLE_ASSIGN,
  USER_VIEW,
} from '@/constants/permissions';

/** 仅保留系统不变量；角色名称与普通权限均由数据库配置。 */
export const ADMIN_ROLE_CODE = 'admin';
export const DEFAULT_USER_ROLE_CODE = 'user';
export const SYSTEM_ROLE_CODES = [ADMIN_ROLE_CODE, DEFAULT_USER_ROLE_CODE] as const;
export const ADMIN_REQUIRED_PERMISSIONS = [
  USER_VIEW,
  USER_MANAGE,
  USER_ROLE_ASSIGN,
  CDN_PURGE_VIEW,
] as const;

export function isSystemRoleCode(code: string): boolean {
  return (SYSTEM_ROLE_CODES as readonly string[]).includes(code);
}
