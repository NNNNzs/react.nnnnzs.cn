/**
 * 认证相关类型定义
 */

/**
 * 认证用户信息（包含权限）
 *
 * 用于 RBAC 权限系统，包含用户的角色和权限信息
 */
export interface AuthUser {
  /** 用户 ID */
  id: number;
  /** 用户账号 */
  account: string;
  /** 用户昵称 */
  nickname: string;
  /** 用户头像 */
  avatar: string | null;
  /** 角色（兼容旧字段，过渡期保留） */
  role: string | null;
  /** 角色编码列表 */
  roles: string[];
  /** 权限码列表 */
  permissions: string[];
  /** 权限码 → data_scope 映射 */
  dataScopes: Record<string, string>;
}
