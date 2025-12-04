/**
 * 文章相关 DTO
 * 参考 api.nnnnzs.cn/src/post/dto
 */

import { TbPost } from '@/entities/post.entity';

/**
 * 序列化后的文章类型（用于 API 响应）
 * - date 和 updated 字段转换为 ISO 字符串
 * - tags 字段从数据库的字符串格式转换为数组格式
 */
export type SerializedPost = Omit<TbPost, 'date' | 'updated' | 'tags'> & {
  date: string | null;
  updated: string | null;
  tags: string[];
};

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
export type ListPostDto = Omit<TbPost, 'content'>;

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

/**
 * 归档数据
 */
export interface Archive {
  year: string;
  posts: SerializedPost[];
}
