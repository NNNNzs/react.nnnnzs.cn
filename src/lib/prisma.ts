/**
 * Prisma Client 单例
 * 确保在开发环境中不会创建多个 Prisma Client 实例
 */

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@/generated/prisma-client/client';

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL 未配置，无法初始化 Prisma Client');
  }
  return url;
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaMariaDb(getDatabaseUrl());

  return new PrismaClient({
    adapter,
    log: process.env.PRISMA_HIDE_QUERY_LOG === 'true' ? ['error', 'warn'] : (process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']),
    // log:['error']
  });
}

function hasCurrentModelDelegates(client: PrismaClient | undefined): client is PrismaClient {
  return Boolean(
    client
    && client.contentTopic
    && client.contentDraft
    && client.contentDraftSlide
    && client.contentAsset
    && client.contentTemplate,
  );
}

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
  hasCurrentModelDelegates(global.prisma) ? global.prisma :
  createPrismaClient();

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
