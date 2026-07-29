/**
 * 合集列表页
 */

import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import CollectionsShowcase from '@/components/collections/CollectionsShowcase';
import { getCollectionShowcaseList } from '@/services/collection';
import { getCollectionHomeVisualConfig } from '@/services/collection-home-visual';

/**
 * 获取合集列表（使用 unstable_cache + 缓存标签）
 */
const getCachedCollections = unstable_cache(
  getCollectionShowcaseList,
  ['collection', 'collection-list'],
  {
    revalidate: 3600,
    tags: ['collection', 'collection-list'],
  }
);

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '文章合集 - NNNNzs',
  description: '按主题浏览 NNNNzs 的长期写作合集，涵盖前端、AI、运维、工具、生活与旅行。',
};

export default async function CollectionsPage() {
  const [collections, homeVisual] = await Promise.all([
    getCachedCollections(),
    getCollectionHomeVisualConfig(),
  ]);

  return <CollectionsShowcase collections={collections} homeVisual={homeVisual} />;
}
