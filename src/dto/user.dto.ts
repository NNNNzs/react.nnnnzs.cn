/**
 * 用户相关 DTO
 */

import { TbUser } from '@/entities/user.entity';

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

