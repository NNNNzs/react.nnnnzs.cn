/**
 * 按分类筛选的文章列表页
 */

import React from 'react';
import { cache } from 'react';
import type { Metadata } from 'next';
import { Empty } from 'antd';
import PostListItem from '@/components/PostListItem';
import Banner from '@/components/Banner';
import { getPostsByCategory } from '@/services/category';
import { createSeoDescription, meetsSeoAggregateThreshold } from '@/lib/seo-content';
import { toAbsoluteSiteUrl } from '@/lib/site-url';

interface PageProps {
  params: Promise<{
    category: string;
  }>;
}

export const revalidate = 60;

const getCachedPostsByCategory = cache(getPostsByCategory);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: rawCategory } = await params;
  const category = decodeURIComponent(rawCategory);
  const posts = await getCachedPostsByCategory(category);
  const indexableCount = posts.filter((post) => post.seo_indexable).length;
  const canonical = toAbsoluteSiteUrl(`/categories/${encodeURIComponent(category)}`);
  const description = createSeoDescription(
    null,
    posts.map((post) => post.description || post.title || '').join('。'),
    `浏览 NNNNzs 的 ${category} 分类文章。`,
  );

  return {
    title: `${category} 分类文章 - NNNNzs`,
    description,
    alternates: { canonical },
    robots: meetsSeoAggregateThreshold(indexableCount)
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: { type: 'website', title: `${category} 分类文章`, description, url: canonical },
  };
}

export default async function CategoryPostsPage({ params }: PageProps) {
  const { category: rawCategory } = await params;
  const category = decodeURIComponent(rawCategory);
  const posts = await getCachedPostsByCategory(category);

  return (
    <div>
      {/* 横幅 */}
      <Banner />

      {/* 标题与统计 */}
      <div className="container mx-auto px-4 pt-8">
        <h1 className="mb-2 text-2xl font-bold">分类: {category}</h1>
        <p className="text-slate-500">共 {posts.length} 篇文章</p>
      </div>

      {/* 文章列表 */}
      <div className="container mx-auto px-4 py-8">
        {posts.length === 0 ? (
          <Empty description="该分类下暂无文章" />
        ) : (
          <ul>
            {posts.map((post) => (
              <PostListItem key={post.id} post={post} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

