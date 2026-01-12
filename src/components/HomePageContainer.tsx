'use client';

import React, { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import HomePageClient from '@/components/HomePageClient';
import type { Post } from '@/types';

interface HomePageContainerProps {
  posts: Post[];
  total: number;
  currentPageNum: number;
}

/**
 * 首页容器组件
 * 负责处理加载更多的逻辑，通过更新 URL 参数触发服务端重新渲染
 */
export default function HomePageContainer({
  posts,
  total,
  currentPageNum,
}: HomePageContainerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /**
   * 加载更多
   * 通过更新 URL 的 pageNum 参数，触发服务端重新渲染
   */
  const handleLoadMore = useCallback(() => {
    const nextPageNum = currentPageNum + 1;
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageNum', String(nextPageNum));
    
    // 使用 replace 更新 URL，触发服务端重新渲染
    router.replace(`/?${params.toString()}`, { scroll: false });
  }, [currentPageNum, router, searchParams]);

  // 计算是否还有更多数据
  const hasMore = posts.length < total;

  return (
    <HomePageClient
      posts={posts}
      hasMore={hasMore}
      onLoadMore={handleLoadMore}
    />
  );
}
