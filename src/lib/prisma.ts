/**
 * Prisma Client 单例
 * 确保在开发环境中不会创建多个 Prisma Client 实例
 */

import { PrismaClient } from '@/generated/prisma-client';

/**
 * 全局 Prisma 实例类型声明
 */
declare global {
  var prisma: PrismaClient | undefined;
}

/**
 * Prisma Client 实例
 */
export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// 在开发环境中保存到全局变量，避免热重载时创建多个实例
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * 获取 Prisma 实例（兼容旧的 API）
 */
export async function getPrisma(): Promise<PrismaClient> {
  return prisma;
}

/**
 * 断开数据库连接
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  console.log('✅ 数据库连接已关闭');
}
