/**
 * 归档页面
 */

import React from 'react';
import Banner from '@/components/Banner';
import { getArchives } from '@/services/post';
import ArchivesList from '@/components/ArchivesList';

export const revalidate = 60;

export default async function ArchivesPage() {
  const archives = await getArchives();
  
  // 计算总文章数
  const totalPosts = archives.reduce((sum, item) => sum + item.posts.length, 0);

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
