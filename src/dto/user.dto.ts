/**
 * 用户相关 DTO
 */

import { TbUser } from '@/generated/prisma-client';

/**
 * 登录 DTO
 */
export interface LoginDto {
  account: string;
  password: string;
}

/**
 * 注册 DTO
 */
export interface RegisterDto {
  account: string;
  password: string;
  nickname: string;
  mail?: string;
  phone?: string;
}

/**
 * 用户信息（不包含密码）
 */
export type UserInfo = Omit<TbUser, 'password'>;

/**
 * 登录响应
 */
export interface LoginResponse {
  token: string;
  userInfo: UserInfo;
}

/**
 * 创建用户 DTO
 */
export interface CreateUserDto {
  account: string;
  password: string;
  nickname: string;
  role?: string;
  mail?: string;
  phone?: string;
  avatar?: string;
  status?: number;
}

/**
 * 更新用户 DTO
 */
export interface UpdateUserDto {
  nickname?: string;
  role?: string;
  mail?: string;
  phone?: string;
  avatar?: string;
  status?: number;
  password?: string;
}

/**
 * 用户查询条件
 */
export interface QueryUserCondition {
  pageNum?: number;
  pageSize?: number;
  query?: string;
  role?: string;
  status?: number;
}

/**
 * 分页查询响应
 */
export interface PageQueryRes<T> {
  record: T[];
  total: number;
  pageNum: number;
  pageSize: number;
}

