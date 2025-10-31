/**
 * 按标签筛选的文章列表页
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Spin, Empty } from 'antd';
import axios from 'axios';
import PostListItem from '@/components/PostListItem';
import Banner from '@/components/Banner';
import type { Post } from '@/types';

export default function TagPostsPage() {
  const params = useParams();
  const tag = decodeURIComponent(params.tag as string);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * 加载文章列表
   */
  const loadPosts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `/api/post/tags/${encodeURIComponent(tag)}`
      );
      if (response.data.status) {
        setPosts(response.data.data);
      }
    } catch (error) {
      console.error('加载文章失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [tag]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* 横幅 */}
      <Banner title={`标签: ${tag}`} subtitle={`共 ${posts.length} 篇文章`} />

      {/* 文章列表 */}
      <div className="container mx-auto px-4 py-8">
        {posts.length === 0 ? (
          <Empty description="该标签下暂无文章" />
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

