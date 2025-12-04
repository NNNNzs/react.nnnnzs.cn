/**
 * 配置相关 DTO
 */

import { TbConfig } from '@/generated/prisma-client';

/**
 * 创建配置 DTO
 */
export type CreateConfigDto = Omit<TbConfig, 'id'>;

/**
 * 更新配置 DTO
 */
export type UpdateConfigDto = Partial<TbConfig>;

/**
 * 列表查询条件
 */
export interface QueryConfigCondition {
  pageSize: number;
  pageNum: number;
  query?: string;
  status?: number;
}

/**
 * 分页响应
 */
export interface PageQueryRes<T> {
  record: T[];
  total: number;
  pageNum: number;
  pageSize: number;
}
