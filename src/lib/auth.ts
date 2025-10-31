/**
 * 认证相关工具函数
 */

import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import type { User } from '@/types';
import RedisService from './redis';

/**
 * Token密钥（实际项目中应该放在环境变量中）
 */
export const TOKEN_KEY = 'blog-token';

/**
 * Token过期时间（7天，单位：秒）
 */
export const TOKEN_EXPIRE = 7 * 24 * 60 * 60;

/**
 * 生成Token
 */
export function generateToken(): string {
  return randomUUID().replace(/-/g, '').toUpperCase();
}

/**
 * 加密密码
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * 验证密码
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  // return bcrypt.compare(password, hashedPassword);
  return password === hashedPassword;
}

/**
 * 存储Token到Redis
 */
export async function storeToken(token: string, user: User): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...userWithoutPassword } = user as User & { password?: string };
  const redisKey = `user:${token}`;
  await RedisService.set(
    redisKey,
    JSON.stringify(userWithoutPassword),
    'EX',
    TOKEN_EXPIRE
  );
}

/**
 * 验证Token并获取用户信息
 */
export async function validateToken(token: string): Promise<User | null> {
  try {
    const redisKey = `user:${token}`;
    const userStr = await RedisService.get(redisKey);
    if (!userStr) {
      return null;
    }
    return JSON.parse(userStr) as User;
  } catch (error) {
    console.error('验证Token失败:', error);
    return null;
  }
}

/**
 * 删除Token
 */
export async function removeToken(token: string): Promise<boolean> {
  const redisKey = `user:${token}`;
  const result = await RedisService.del(redisKey);
  return result > 0;
}

/**
 * 从请求头中获取Token
 */
export function getTokenFromRequest(
  headers: Headers | Record<string, string | string[] | undefined>
): string | null {
  if (headers instanceof Headers) {
    const authHeader = headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    const cookieHeader = headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`${TOKEN_KEY}=([^;]+)`));
      if (match) {
        return match[1];
      }
    }
  } else {
    // 处理普通对象格式的headers
    const authHeader = headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    const cookieHeader = headers.cookie;
    if (typeof cookieHeader === 'string') {
      const match = cookieHeader.match(new RegExp(`${TOKEN_KEY}=([^;]+)`));
      if (match) {
        return match[1];
      }
    }
  }
  
  return null;
}

/**
 * 创建响应成功
 */
export function successResponse<T>(data: T, message = '成功') {
  return {
    status: true,
    message,
    data,
  };
}

/**
 * 创建响应失败
 */
export function errorResponse(message = '失败', data: unknown = null) {
  return {
    status: false,
    message,
    data,
  };
}

