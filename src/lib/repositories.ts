/**
 * Repository 工厂
 * 提供统一的 Repository 获取方法
 */

import { Repository } from 'typeorm';
import { getDataSource } from './data-source';
import { TbPost } from '@/entities/post.entity';
import { TbUser } from '@/entities/user.entity';

/**
 * 获取文章 Repository
 */
export async function getPostRepository(): Promise<Repository<TbPost>> {
  const dataSource = await getDataSource();
  return dataSource.getRepository(TbPost);
}

/**
 * 获取用户 Repository
 */
export async function getUserRepository(): Promise<Repository<TbUser>> {
  const dataSource = await getDataSource();
  return dataSource.getRepository(TbUser);
}

