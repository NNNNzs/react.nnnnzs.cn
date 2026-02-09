/**
 * 点赞记录服务
 * 处理点赞状态检查和记录创建
 * 基于 IP 的防刷机制
 */

import type { NextRequest } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/ip';
import { getRedisClient } from '@/lib/redis';
import { getLikeIpLimitHours } from '@/lib/analytics-config';

/**
 * 目标类型枚举
 */
export type TargetType = 'POST' | 'COLLECTION' | 'COMMENT';

/**
 * 检查是否可以点赞
 * @param targetType 目标类型
 * @param targetId 目标ID
 * @param request NextRequest 对象
 * @returns true 表示可以点赞，false 表示已点赞
 */
export async function canLike(
  targetType: TargetType,
  targetId: number,
  request: NextRequest
): Promise<boolean> {
  const ip = getClientIp(request);
  const redis = getRedisClient();

  // 1. 先检查 Redis 缓存
  const cacheKey = `like:${targetType}:${targetId}:${ip}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return false; // 已点赞
  }

  // 2. 检查数据库（兜底）
  const prisma = await getPrisma();
  const limitHours = await getLikeIpLimitHours();
  const timeLimit = new Date(Date.now() - limitHours * 60 * 60 * 1000);

  const existingRecord = await prisma.tbLikeRecord.findFirst({
    where: {
      target_type: targetType,
      target_id: targetId,
      ip_address: ip,
      created_at: {
        gte: timeLimit,
      },
    },
  });

  if (existingRecord) {
    // 更新 Redis 缓存
    const ttl = limitHours * 3600;
    await redis.setex(cacheKey, ttl, '1');
    return false;
  }

  return true;
}

/**
 * 记录点赞行为
 * @param targetType 目标类型
 * @param targetId 目标ID
 * @param request NextRequest 对象
 */
export async function recordLike(
  targetType: TargetType,
  targetId: number,
  request: NextRequest
): Promise<void> {
  const ip = getClientIp(request);
  const redis = getRedisClient();
  const prisma = await getPrisma();
  const limitHours = await getLikeIpLimitHours();
  const cacheKey = `like:${targetType}:${targetId}:${ip}`;
  const ttl = limitHours * 3600;

  // 1. 写入数据库
  await prisma.tbLikeRecord.create({
    data: {
      target_type: targetType,
      target_id: targetId,
      ip_address: ip,
    },
  });

  // 2. 写入 Redis 缓存
  await redis.setex(cacheKey, ttl, '1');

  // 3. 异步清理过期记录（1% 概率触发，避免高并发时数据库压力）
  if (Math.random() < 0.01) {
    cleanupOldRecords().catch((err) => {
      console.error('清理过期点赞记录失败:', err);
    });
  }
}

/**
 * 查询用户点赞状态（批量）
 * @param targetType 目标类型
 * @param targetIds 目标ID列表
 * @param request NextRequest 对象
 * @returns Set of target IDs that are liked
 */
export async function checkLikedStatus(
  targetType: TargetType,
  targetIds: number[],
  request: NextRequest
): Promise<Set<number>> {
  const ip = getClientIp(request);
  const redis = getRedisClient();
  const prisma = await getPrisma();
  const limitHours = await getLikeIpLimitHours();
  const timeLimit = new Date(Date.now() - limitHours * 60 * 60 * 1000);

  const likedIds = new Set<number>();

  // 并行查询 Redis 和数据库
  const [redisResults, dbResults] = await Promise.all([
    // Redis 查询（批量）
    Promise.all(
      targetIds.map((id) =>
        redis.get(`like:${targetType}:${id}:${ip}`).then((cached) => ({
          id,
          cached,
        }))
      )
    ),
    // 数据库查询
    prisma.tbLikeRecord.findMany({
      where: {
        target_type: targetType,
        target_id: { in: targetIds },
        ip_address: ip,
        created_at: { gte: timeLimit },
      },
      select: { target_id: true },
    }),
  ]);

  // 合并结果
  redisResults.forEach(({ id, cached }) => {
    if (cached) likedIds.add(id);
  });

  dbResults.forEach((record) => {
    likedIds.add(record.target_id);
  });

  return likedIds;
}

/**
 * 清理过期的点赞记录（异步执行）
 */
async function cleanupOldRecords(): Promise<void> {
  const prisma = await getPrisma();
  const limitHours = await getLikeIpLimitHours();
  const timeLimit = new Date(Date.now() - limitHours * 60 * 60 * 1000);

  const result = await prisma.tbLikeRecord.deleteMany({
    where: {
      created_at: {
        lt: timeLimit,
      },
    },
  });

  if (result.count > 0) {
    console.log(`清理了 ${result.count} 条过期点赞记录`);
  }
}
