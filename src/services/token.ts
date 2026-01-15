/**
 * Token管理服务
 */

import { getPrisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import type { LongTermTokenRecord } from '@/dto/user.dto';

/**
 * 创建长期Token
 */
export async function createLongTermToken(
  userId: string,
  duration: number,
  description: string
): Promise<LongTermTokenRecord> {
  const prisma = await getPrisma();

  // 计算过期时间
  let expiresAt: Date | null = null;
  if (duration > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + duration);
  }

  // 生成Token（使用UUID格式，但加上前缀便于识别）
  // 注意: Token总长度需要控制在191字符以内以兼容MySQL索引限制
  const token = `LTK_${generateToken()}`;

  // 保存到数据库
  const record = await prisma.longTermToken.create({
    data: {
      token,
      userId: parseInt(userId),
      expiresAt,
      description,
    },
  });

  return {
    id: record.id,
    token: record.token,
    userId: record.userId.toString(),
    expiresAt: record.expiresAt?.toISOString() || null,
    createdAt: record.createdAt.toISOString(),
    description: record.description,
    lastUsed: record.lastUsed?.toISOString() || null,
  };
}

/**
 * 获取用户的长期Token列表
 */
export async function getUserLongTermTokens(userId: string): Promise<LongTermTokenRecord[]> {
  const prisma = await getPrisma();

  const records = await prisma.longTermToken.findMany({
    where: {
      userId: parseInt(userId),
      // 只返回未过期的或永久有效的
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return records.map(record => ({
    id: record.id,
    token: record.token,
    userId: record.userId.toString(),
    expiresAt: record.expiresAt?.toISOString() || null,
    createdAt: record.createdAt.toISOString(),
    description: record.description,
    lastUsed: record.lastUsed?.toISOString() || null,
  }));
}

/**
 * 验证长期Token
 */
export async function validateLongTermToken(token: string): Promise<string | null> {
  const prisma = await getPrisma();

  const record = await prisma.longTermToken.findUnique({
    where: { token },
  });

  if (!record) {
    return null;
  }

  // 检查是否过期
  if (record.expiresAt && record.expiresAt < new Date()) {
    return null;
  }

  // 更新最后使用时间
  await prisma.longTermToken.update({
    where: { token },
    data: { lastUsed: new Date() },
  });

  // 返回userId作为字符串
  return record.userId.toString();
}

/**
 * 删除长期Token
 */
export async function deleteLongTermToken(id: string, userId: string): Promise<boolean> {
  const prisma = await getPrisma();

  const result = await prisma.longTermToken.deleteMany({
    where: {
      id,
      userId: parseInt(userId), // 确保只能删除自己的token
    },
  });

  return result.count > 0;
}

/**
 * 清理过期的Token（定时任务使用）
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const prisma = await getPrisma();

  const result = await prisma.longTermToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
        not: null,
      },
    },
  });

  return result.count;
}