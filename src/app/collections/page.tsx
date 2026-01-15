/**
 * 合集列表页
 */

import React from 'react';
import { Empty } from 'antd';
import Banner from '@/components/Banner';
import CollectionCard from '@/components/CollectionCard';
import { getCollectionList } from '@/services/collection';

export const revalidate = 60;

export default async function CollectionsPage() {
  // 获取所有合集（第一页，每页100个）
  const result = await getCollectionList({
    pageSize: 100,
    pageNum: 1,
    status: 1,
  });

  const collections = result.record;

  return (
    <div>
      {/* 横幅 */}
      <Banner title="合集" subtitle="按合集浏览文章" />

      {/* 合集列表 */}
      <div className="container mx-auto px-4 py-8">
        {collections.length === 0 ? (
          <Empty description="暂无合集" />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
