/**
 * 按分类筛选的文章列表页
 */

import React from 'react';
import { Empty } from 'antd';
import PostListItem from '@/components/PostListItem';
import Banner from '@/components/Banner';
import { getPostsByCategory } from '@/services/category';

interface PageProps {
  params: Promise<{
    category: string;
  }>;
}

export const revalidate = 60;

export default async function CategoryPostsPage({ params }: PageProps) {
  const { category: rawCategory } = await params;
  const category = decodeURIComponent(rawCategory);
  const posts = await getPostsByCategory(category);

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

