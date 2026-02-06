/**
 * 合集列表页
 */

import React from 'react';
import { Empty } from 'antd';
import { unstable_cache } from 'next/cache';
import Banner from '@/components/Banner';
import CollectionCard from '@/components/CollectionCard';
import { getCollectionList } from '@/services/collection';
import type { SerializedCollection } from '@/dto/collection.dto';

/**
 * 获取合集列表（使用 unstable_cache + 缓存标签）
 */
const getCachedCollections = unstable_cache(
  async () => {
    return await getCollectionList({
      pageSize: 100,
      pageNum: 1,
      status: 1,
    });
  },
  ['collection', 'collection-list'],
  {
    revalidate: 3600,
    tags: ['collection', 'collection-list'],
  }
);

export const revalidate = 3600;

export default async function CollectionsPage() {
  const result = await getCachedCollections();
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
            {collections.map((collection: SerializedCollection) => (
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
