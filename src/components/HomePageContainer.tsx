'use client';

import React, { useState, useCallback, useRef } from 'react';
import HomePageClient from '@/components/HomePageClient';
import type { Post } from '@/types';

const PAGE_SIZE = 10;

interface HomePageContainerProps {
  posts: Post[];
  total: number;
}

/**
 * 首页容器组件
 * 负责处理加载更多的逻辑，通过客户端 API 调用加载更多文章
 */
export default function HomePageContainer({
  posts: initialPosts,
  total,
}: HomePageContainerProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  /**
   * 加载更多 - 通过客户端 API 调用
   */
  const handleLoadMore = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      // 使用当前 posts 长度计算下一页，避免依赖 state 闭包
      const nextPage = Math.floor(posts.length / PAGE_SIZE) + 1;
      const res = await fetch(`/api/post/list?pageNum=${nextPage}&pageSize=${PAGE_SIZE}&hide=0`);
      const json = await res.json();

      if (json.status && json.data?.record) {
        setPosts(prev => [...prev, ...json.data.record]);
      }
    } catch (error) {
      console.error('加载更多文章失败:', error);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [posts.length]);

  // 计算是否还有更多数据
  const hasMore = posts.length < total;

  return (
    <HomePageClient
      posts={posts}
      hasMore={hasMore}
      loading={loading}
      onLoadMore={handleLoadMore}
    />
  );
}
