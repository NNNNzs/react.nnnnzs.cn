/**
 * Repository 工厂
 * 提供统一的 Repository 获取方法
 */

import { Repository } from 'typeorm';
import { getDataSource } from './data-source';
import { TbPost } from '@/entities/post.entity';
import { TbUser } from '@/entities/user.entity';
import { TbConfig } from '@/entities/config.entity';

/**
 * 获取文章 Repository
 */
export async function getPostRepository(): Promise<Repository<TbPost>> {
  if (process.env.IS_BUILD === 'true') {
    console.log('🚧 构建环境，使用 Mock Repository');
    return {
      find: async () => [],
      findOne: async () => null,
      findAndCount: async () => [[], 0],
    } as unknown as Repository<TbPost>;
  }
  const dataSource = await getDataSource();
  return dataSource.getRepository(TbPost);
}

/**
 * 获取用户 Repository
 */
export async function getUserRepository(): Promise<Repository<TbUser>> {
  if (process.env.IS_BUILD === 'true') {
    return {
      findOne: async () => null,
      save: async (entity: unknown) => entity,
    } as unknown as Repository<TbUser>;
  }
  const dataSource = await getDataSource();
  return dataSource.getRepository(TbUser);
}

/**
 * 获取配置 Repository
 */
export async function getConfigRepository(): Promise<Repository<TbConfig>> {
  if (process.env.IS_BUILD === 'true') {
    console.log('🚧 构建环境，使用 Mock Repository');
    return {
      find: async () => [],
      findOne: async () => null,
      findAndCount: async () => [[], 0],
      save: async (entity: unknown) => entity,
      update: async () => ({ affected: 1 }),
      delete: async () => ({ affected: 1 }),
    } as unknown as Repository<TbConfig>;
  }
  const dataSource = await getDataSource();
  return dataSource.getRepository(TbConfig);
}

