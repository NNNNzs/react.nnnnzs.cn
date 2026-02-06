/**
 * 合集详情页
 */

import React from 'react';
import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import { BookOutlined, EyeOutlined, HeartOutlined } from '@ant-design/icons';
import Banner from '@/components/Banner';
import ArticleInCollectionItem from '@/components/ArticleInCollectionItem';
import { getCollectionBySlug } from '@/services/collection';
import type { ArticleInCollection } from '@/dto/collection.dto';

/**
 * 获取合集详情（使用 unstable_cache + 缓存标签）
 */
const getCachedCollectionBySlug = unstable_cache(
  async (slug: string) => {
    return await getCollectionBySlug(slug);
  },
  ['collection'],
  {
    revalidate: 3600,
    tags: ['collection'],
  }
);

export const revalidate = 3600;

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getCachedCollectionBySlug(slug);

  if (!collection) {
    notFound();
  }

  return (
    <div>
      {/* 横幅 */}
      <Banner
        title={collection.title}
        subtitle={collection.description || ''}
        cover={collection.background || undefined}
      />

      {/* 合集内容 */}
      <div className="container mx-auto px-4 py-8">
        {/* 统计信息栏 */}
        <div className="flex gap-6 mb-8 p-4 bg-gray-50 rounded-lg dark:bg-slate-800">
          <span className="flex items-center gap-2">
            <BookOutlined />
            {collection.article_count} 篇文章
          </span>
          <span className="flex items-center gap-2">
            <EyeOutlined />
            {collection.total_views} 次浏览
          </span>
          <span className="flex items-center gap-2">
            <HeartOutlined />
            {collection.total_likes} 个赞
          </span>
        </div>

        {/* 文章列表 */}
        {collection.articles.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            该合集暂无文章
          </div>
        ) : (
          <div className="space-y-4">
            {collection.articles.map((article: ArticleInCollection, index: number) => (
              <ArticleInCollectionItem
                key={article.id}
                article={article}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 生成元数据
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getCachedCollectionBySlug(slug);

  if (!collection) {
    return {
      title: '合集不存在',
    };
  }

  return {
    title: `${collection.title} - 合集`,
    description: collection.description || collection.title,
  };
}
