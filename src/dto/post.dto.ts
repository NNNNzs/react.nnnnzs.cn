/**
 * 文章相关 DTO
 * 参考 api.nnnnzs.cn/src/post/dto
 */

import { TbPost } from '@/entities/post.entity';

/**
 * 创建文章 DTO
 */
export type CreatePostDto = Omit<TbPost, 'id' | 'likes' | 'visitors' | 'is_delete'>;

/**
 * 更新文章 DTO
 */
export type UpdatePostDto = Partial<TbPost>;

/**
 * 列表查询 DTO
 */
export interface ListPostDto extends Omit<TbPost, 'content'> {}

/**
 * 查询条件
 */
export interface QueryCondition {
  pageSize: number;
  pageNum: number;
  hide?: string;
  query?: string;
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

