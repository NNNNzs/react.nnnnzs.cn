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
 * Mock 模型操作参数类型
 */
interface MockOperationArgs {
  data?: Record<string, unknown>;
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
}

/**
 * 创建一个基础的 Mock 模型操作
 * 用于构建时避免数据库连接
 */
function createMockModel() {
  return {
    findMany: async () => [],
    findUnique: async () => null,
    findFirst: async () => null,
    findUniqueOrThrow: async () => { throw new Error('Mock: Not found'); },
    findFirstOrThrow: async () => { throw new Error('Mock: Not found'); },
    count: async () => 0,
    aggregate: async () => ({ _count: 0, _avg: {}, _sum: {}, _min: {}, _max: {} }),
    groupBy: async () => [],
    create: async (args: MockOperationArgs = {}) => args?.data || {},
    createMany: async () => ({ count: 0 }),
    update: async (args: MockOperationArgs = {}) => args?.data || {},
    updateMany: async () => ({ count: 0 }),
    upsert: async (args: MockOperationArgs = {}) => args?.create || args?.update || {},
    delete: async () => ({}),
    deleteMany: async () => ({ count: 0 }),
  };
}

/**
 * 获取 Prisma 实例（兼容旧的 API）
 */
export async function getPrisma(): Promise<PrismaClient> {
  // 在构建时返回一个 mock 实例
  if (process.env.IS_BUILD === 'true') {
    console.log('🚧 构建环境，使用 Mock Prisma Client');
    return {
      tbPost: createMockModel(),
      tbUser: createMockModel(),
      tbConfig: createMockModel(),
      $connect: async () => {},
      $disconnect: async () => {},
      $executeRaw: async () => 0,
      $executeRawUnsafe: async () => 0,
      $queryRaw: async () => [],
      $queryRawUnsafe: async () => [],
      $transaction: async <T>(fn: ((prisma: {
        tbPost: ReturnType<typeof createMockModel>;
        tbUser: ReturnType<typeof createMockModel>;
        tbConfig: ReturnType<typeof createMockModel>;
      }) => Promise<T>) | unknown[]): Promise<T | unknown[]> => {
        if (typeof fn === 'function') {
          return fn({
            tbPost: createMockModel(),
            tbUser: createMockModel(),
            tbConfig: createMockModel(),
          });
        }
        return fn as unknown[];
      },
    } as unknown as PrismaClient;
  }
  
  return prisma;
}

/**
 * 断开数据库连接
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  console.log('✅ 数据库连接已关闭');
}
