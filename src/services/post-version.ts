/**
 * 文章版本管理服务
 */

import { getPrisma } from '@/lib/prisma';
import type { TbPostVersion } from '@/generated/prisma-client';

/**
 * 创建文章版本
 * 
 * @param postId 文章ID
 * @param content 文章内容
 * @param createdBy 创建人ID（可选）
 * @returns 创建的版本记录
 */
export async function createPostVersion(
  postId: number,
  content: string,
  createdBy?: number
): Promise<TbPostVersion> {
  const prisma = await getPrisma();

  // 获取当前最大版本号
  const maxVersion = await prisma.tbPostVersion.findFirst({
    where: {
      post_id: postId,
    },
    orderBy: {
      version: 'desc',
    },
    select: {
      version: true,
    },
  });

  const nextVersion = (maxVersion?.version || 0) + 1;

  // 创建新版本
  const version = await prisma.tbPostVersion.create({
    data: {
      post_id: postId,
      version: nextVersion,
      content: content,
      created_by: createdBy || null,
    },
  });

  return version;
}

/**
 * 获取文章的所有版本列表
 * 
 * @param postId 文章ID
 * @returns 版本列表（按版本号降序）
 */
export async function getPostVersions(
  postId: number
): Promise<TbPostVersion[]> {
  const prisma = await getPrisma();

  const versions = await prisma.tbPostVersion.findMany({
    where: {
      post_id: postId,
    },
    orderBy: {
      version: 'desc',
    },
  });

  return versions;
}

/**
 * 获取指定版本的内容
 * 
 * @param postId 文章ID
 * @param version 版本号
 * @returns 版本记录
 */
export async function getPostVersion(
  postId: number,
  version: number
): Promise<TbPostVersion | null> {
  const prisma = await getPrisma();

  const versionRecord = await prisma.tbPostVersion.findFirst({
    where: {
      post_id: postId,
      version: version,
    },
  });

  return versionRecord;
}

/**
 * 获取文章的当前版本号
 * 
 * @param postId 文章ID
 * @returns 当前版本号，如果不存在返回 0
 */
export async function getCurrentVersion(postId: number): Promise<number> {
  const prisma = await getPrisma();

  const maxVersion = await prisma.tbPostVersion.findFirst({
    where: {
      post_id: postId,
    },
    orderBy: {
      version: 'desc',
    },
    select: {
      version: true,
    },
  });

  return maxVersion?.version || 0;
}

/**
 * 回滚到指定版本
 * 回滚本质：使用指定版本的内容生成新版本
 * 
 * @param postId 文章ID
 * @param targetVersion 目标版本号
 * @param createdBy 创建人ID（可选）
 * @returns 新创建的版本记录
 */
export async function rollbackToVersion(
  postId: number,
  targetVersion: number,
  createdBy?: number
): Promise<TbPostVersion> {
  // 获取目标版本的内容
  const targetVersionRecord = await getPostVersion(postId, targetVersion);
  if (!targetVersionRecord) {
    throw new Error(`版本 ${targetVersion} 不存在`);
  }

  // 使用目标版本的内容创建新版本
  return createPostVersion(postId, targetVersionRecord.content, createdBy);
}
