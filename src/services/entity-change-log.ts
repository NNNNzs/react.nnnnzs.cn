/**
 * 实体变更日志服务
 *
 * 负责创建、查询和管理实体变更日志
 * 所有日志记录操作都是异步的，不影响主业务流程
 */

import { prisma } from '@/lib/prisma';
import {
  EntityType,
  CreateChangeLogsParams,
  QueryChangeLogsParams,
  EntityChangeLog,
  EntityChangeStats,
  ValueType,
} from '@/types/entity-change';

/**
 * 序列化单个值用于存储
 *
 * @param value - 需要序列化的值
 * @param valueType - 值类型
 * @returns 序列化后的字符串
 */
function serializeValueForLog(value: unknown, valueType: ValueType): string {
  if (value === null || value === undefined) {
    return '';
  }

  switch (valueType) {
    case ValueType.ARRAY:
    case ValueType.OBJECT:
    case ValueType.DATE:
      return JSON.stringify(value);
    default:
      return String(value);
  }
}

/**
 * 创建变更日志（异步，不阻塞主流程）
 *
 * 该函数会立即返回，日志创建在后台异步执行
 * 如果日志创建失败，只会记录错误日志，不影响主业务
 *
 * @param params - 创建日志参数
 */
export async function createChangeLogsAsync(
  params: CreateChangeLogsParams
): Promise<void> {
  // 异步执行，不等待结果
  (async () => {
    try {
      await createChangeLogs(params);
    } catch (error) {
      console.error('❌ 创建变更日志失败:', error);
      // 不抛出错误，不影响主业务
    }
  })();
}

/**
 * 创建变更日志（同步）
 *
 * @param params - 创建日志参数
 * @throws 如果数据库操作失败会抛出错误
 */
export async function createChangeLogs(
  params: CreateChangeLogsParams
): Promise<void> {
  const { entityId, entityType, changes, userId } = params;

  // 如果没有变更，直接返回
  if (changes.length === 0) {
    return;
  }

  // 准备批量插入数据
  const logs = changes.map((change) => ({
    entity_id: entityId,
    entity_type: entityType,
    field_name: change.fieldName,
    old_value: serializeValueForLog(change.oldValue, change.valueType),
    new_value: serializeValueForLog(change.newValue, change.valueType),
    value_type: change.valueType,
    created_by: userId,
  }));

  // 批量插入数据库
  await prisma.tbEntityChangeLog.createMany({
    data: logs,
    skipDuplicates: false,
  });
}

/**
 * 查询实体变更历史
 *
 * @param params - 查询参数
 * @returns 变更日志列表
 */
export async function queryEntityChangeLogs(
  params: QueryChangeLogsParams
): Promise<EntityChangeLog[]> {
  const {
    entityId,
    entityType,
    userId,
    fieldName,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = params;

  // 构建 where 条件
  const where: Record<string, unknown> = {};

  if (entityId !== undefined) {
    where.entity_id = entityId;
  }
  if (entityType !== undefined) {
    where.entity_type = entityType;
  }
  if (userId !== undefined) {
    where.created_by = userId;
  }
  if (fieldName !== undefined) {
    where.field_name = fieldName;
  }
  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) {
      where.created_at = { ...where.created_at as object, gte: startDate };
    }
    if (endDate) {
      where.created_at = { ...where.created_at as object, lte: endDate };
    }
  }

  // 查询数据库
  const logs = await prisma.tbEntityChangeLog.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: limit,
    skip: offset,
  });

  // 转换为统一格式
  return logs.map((log) => ({
    id: log.id,
    entityId: log.entity_id,
    entityType: log.entity_type,
    fieldName: log.field_name,
    oldValue: log.old_value,
    newValue: log.new_value,
    valueType: log.value_type,
    createdAt: log.created_at,
    createdBy: log.created_by,
  }));
}

/**
 * 获取实体变更统计
 *
 * @param entityId - 实体ID
 * @param entityType - 实体类型
 * @returns 变更统计信息
 */
export async function getEntityChangeStats(
  entityId: number,
  entityType: EntityType
): Promise<EntityChangeStats> {
  const [count, latest] = await Promise.all([
    prisma.tbEntityChangeLog.count({
      where: { entity_id: entityId, entity_type: entityType },
    }),
    prisma.tbEntityChangeLog.findFirst({
      where: { entity_id: entityId, entity_type: entityType },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    }),
  ]);

  return {
    totalChanges: count,
    lastChangeAt: latest?.created_at || null,
  };
}

/**
 * 获取实体的特定字段变更历史
 *
 * @param entityId - 实体ID
 * @param entityType - 实体类型
 * @param fieldName - 字段名
 * @param limit - 返回数量限制
 * @returns 该字段的变更历史
 */
export async function getFieldChangeHistory(
  entityId: number,
  entityType: EntityType,
  fieldName: string,
  limit: number = 10
): Promise<EntityChangeLog[]> {
  return queryEntityChangeLogs({
    entityId,
    entityType,
    fieldName,
    limit,
  });
}

/**
 * 获取用户的操作历史
 *
 * @param userId - 用户ID
 * @param limit - 返回数量限制
 * @param offset - 偏移量
 * @returns 用户的操作历史
 */
export async function getUserOperationHistory(
  userId: number,
  limit: number = 50,
  offset: number = 0
): Promise<EntityChangeLog[]> {
  return queryEntityChangeLogs({
    userId,
    limit,
    offset,
  });
}

/**
 * 清理旧的变更日志
 *
 * @param beforeDate - 清理此日期之前的日志
 * @returns 删除的日志数量
 */
export async function cleanOldChangeLogs(
  beforeDate: Date
): Promise<number> {
  const result = await prisma.tbEntityChangeLog.deleteMany({
    where: {
      created_at: {
        lt: beforeDate,
      },
    },
  });

  return result.count;
}
