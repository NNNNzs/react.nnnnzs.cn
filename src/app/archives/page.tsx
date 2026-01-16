/**
 * 归档页面
 */

import React from 'react';
import { unstable_cache } from 'next/cache';
import Banner from '@/components/Banner';
import ArchivesList from '@/components/ArchivesList';
import { getArchives } from '@/services/post';

/**
 * 获取归档数据（使用 unstable_cache + 缓存标签）
 */
const getCachedArchives = unstable_cache(
  async () => {
    return await getArchives();
  },
  ['archives'],
  {
    revalidate: 3600,
    tags: ['archives'],
  }
);

export const revalidate = 3600;

export default async function ArchivesPage() {
  const archives = await getCachedArchives();

  // 计算总文章数
  const totalPosts = archives.reduce((sum: number, item: { posts: unknown[] }) => sum + item.posts.length, 0);

  return (
    <div>
      {/* 横幅 */}
      <Banner title="归档" subtitle={`共 ${totalPosts} 篇文章`} />

      {/* 归档列表 */}
      <div className="container mx-auto px-4 py-8">
        <ArchivesList archives={archives} />
      </div>
    </div>
  );
}
