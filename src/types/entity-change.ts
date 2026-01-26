/**
 * 实体变更日志系统 - 类型定义
 *
 * 用于记录文章、合集等实体的字段变更历史
 */

/**
 * 实体类型枚举
 * 标识需要记录变更的实体类型
 */
export enum EntityType {
  POST = 'POST',
  COLLECTION = 'COLLECTION',
  // 未来可扩展
  // CATEGORY = 'CATEGORY',
  // TAG = 'TAG',
  // COMMENT = 'COMMENT',
}

/**
 * 值类型枚举
 * 标识字段值的数据类型，用于正确的序列化和反序列化
 */
export enum ValueType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
  DATE = 'date',
  NULL = 'null',
}

/**
 * 字段变更记录
 * 描述单个字段的变更信息
 */
export interface FieldChange {
  /** 字段名（数据库字段名） */
  fieldName: string;
  /** 显示名称（用于前端展示） */
  displayName: string;
  /** 旧值 */
  oldValue: unknown;
  /** 新值 */
  newValue: unknown;
  /** 值类型 */
  valueType: ValueType;
}

/**
 * 创建变更日志参数
 */
export interface CreateChangeLogsParams {
  /** 实体ID */
  entityId: number;
  /** 实体类型 */
  entityType: EntityType;
  /** 字段变更列表 */
  changes: FieldChange[];
  /** 操作人ID（可选） */
  userId?: number;
}

/**
 * 查询变更历史参数
 */
export interface QueryChangeLogsParams {
  /** 实体ID（可选） */
  entityId?: number;
  /** 实体类型（可选） */
  entityType?: EntityType;
  /** 操作人ID（可选） */
  userId?: number;
  /** 字段名（可选） */
  fieldName?: string;
  /** 开始日期（可选） */
  startDate?: Date;
  /** 结束日期（可选） */
  endDate?: Date;
  /** 返回数量限制（默认50） */
  limit?: number;
  /** 偏移量（用于分页） */
  offset?: number;
}

/**
 * 变更日志记录
 * 从数据库返回的单条变更日志
 */
export interface EntityChangeLog {
  /** 日志ID */
  id: number;
  /** 实体ID */
  entityId: number;
  /** 实体类型 */
  entityType: string;
  /** 字段名 */
  fieldName: string;
  /** 旧值（JSON字符串） */
  oldValue: string | null;
  /** 新值（JSON字符串） */
  newValue: string | null;
  /** 值类型 */
  valueType: string;
  /** 创建时间 */
  createdAt: Date;
  /** 操作人ID */
  createdBy: number | null;
}

/**
 * 实体变更统计
 */
export interface EntityChangeStats {
  /** 总变更次数 */
  totalChanges: number;
  /** 最后变更时间 */
  lastChangeAt: Date | null;
}
