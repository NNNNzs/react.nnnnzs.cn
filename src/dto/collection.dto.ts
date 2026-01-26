/**
 * 合集相关 DTO
 * 参考 docs/blog-collection-design.md
 */

import { TbCollection } from '@/generated/prisma-client';
import { SerializedPost } from './post.dto';

/**
 * 序列化后的合集类型（用于 API 响应）
 * - created_at 和 updated_at 字段转换为 ISO 字符串
 */
export type SerializedCollection = Omit<TbCollection, 'created_at' | 'updated_at'> & {
  created_at: string;
  updated_at: string;
};

/**
 * 合集中的文章信息（包含排序序号）
 */
export type ArticleInCollection = SerializedPost & {
  sort_order: number;
};

/**
 * 合集详情（包含文章列表）
 */
export type CollectionDetail = SerializedCollection & {
  articles: ArticleInCollection[];
};

/**
 * 文章所属的合集信息
 */
export type PostCollectionInfo = {
  id: number;
  title: string;
  slug: string;
  cover?: string | null;
  color?: string | null;
  sort_order: number;
};

/**
 * 创建合集 DTO
 */
export type CreateCollectionDto = {
  title: string;
  slug: string;
  description?: string | null;
  cover?: string | null;
  background?: string | null;
  color?: string | null;
  created_by?: number;
};

/**
 * 更新合集 DTO
 */
export type UpdateCollectionDto = Partial<CreateCollectionDto> & {
  status?: number;
  updated_by?: number; // 更新人ID
};

/**
 * 合集查询条件
 */
export interface CollectionQueryCondition {
  pageSize: number;
  pageNum: number;
  status?: number;
}

/**
 * 合集分页响应
 */
export type CollectionPageQueryRes = {
  record: SerializedCollection[];
  total: number;
  pageNum: number;
  pageSize: number;
};

/**
 * 文章关联到合集 DTO
 */
export type AddPostsToCollectionDto = {
  post_ids: number[];
  sort_orders?: number[];
};

/**
 * 调整合集内文章顺序 DTO
 */
export type UpdateCollectionOrderDto = {
  orders: {
    post_id: number;
    sort_order: number;
  }[];
};
