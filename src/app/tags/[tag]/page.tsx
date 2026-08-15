/**
 * 按标签筛选的文章列表页
 */

import React from 'react';
import type { Metadata } from 'next';
import { Empty } from 'antd';
import { unstable_cache } from 'next/cache';
import PostListItem from '@/components/PostListItem';
import Banner from '@/components/Banner';
import { getPostsByTag } from '@/services/tag';
import type { Post } from '@/types';
import { createSeoDescription, meetsSeoAggregateThreshold } from '@/lib/seo-content';
import { toAbsoluteSiteUrl } from '@/lib/site-url';

interface PageProps {
  params: Promise<{
    tag: string;
  }>;
}

/**
 * 根据标签获取文章列表（使用 unstable_cache + 缓存标签）
 */
const getCachedPostsByTag = unstable_cache(
  async (tag: string) => {
    return await getPostsByTag(tag);
  },
  ['tag'],
  {
    revalidate: 3600,
    tags: ['tags'],
  }
);

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag: rawTag } = await params;
  const tag = decodeURIComponent(rawTag);
  const posts = await getCachedPostsByTag(tag);
  const indexableCount = posts.filter((post) => post.seo_indexable).length;
  const canonical = toAbsoluteSiteUrl(`/tags/${encodeURIComponent(tag)}`);
  const description = createSeoDescription(
    null,
    posts.map((post) => post.description || post.title || '').join('。'),
    `浏览 NNNNzs 关于 ${tag} 的文章。`,
  );

  return {
    title: `${tag} 标签文章 - NNNNzs`,
    description,
    alternates: { canonical },
    robots: meetsSeoAggregateThreshold(indexableCount)
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: { type: 'website', title: `${tag} 标签文章`, description, url: canonical },
  };
}

export default async function TagPostsPage({ params }: PageProps) {
  const { tag: rawTag } = await params;
  const tag = decodeURIComponent(rawTag);
  const posts = await getCachedPostsByTag(tag);

  return (
    <div>
      {/* 横幅 */}
      <Banner />

      {/* 标题与统计 */}
      <div className="container mx-auto px-4 pt-8">
        <h1 className="mb-2 text-2xl font-bold">标签: {tag}</h1>
        <p className="text-slate-500">共 {posts.length} 篇文章</p>
      </div>

      {/* 文章列表 */}
      <div className="container mx-auto px-4 py-8">
        {posts.length === 0 ? (
          <Empty description="该标签下暂无文章" />
        ) : (
          <ul>
            {posts.map((post: Post) => (
              <PostListItem key={post.id} post={post} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
