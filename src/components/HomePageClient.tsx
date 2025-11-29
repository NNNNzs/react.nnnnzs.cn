'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Banner from '@/components/Banner';
import PostListItem from '@/components/PostListItem';
import type { Post, PageQueryRes } from '@/types';

interface HomePageClientProps {
  initialPosts: Post[];
  initialTotal: number;
}

export default function HomePageClient({ initialPosts, initialTotal }: HomePageClientProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const pageSize = 20;
  const anchorRef = useRef<HTMLDivElement>(null);

  /**
   * 加载文章列表
   */
  const loadPosts = async (page: number) => {
    try {
      setLoadingMore(true);

      const response = await axios.get<{
        status: boolean;
        data: PageQueryRes<Post>;
      }>('/api/post/list', {
        params: { pageNum: page, pageSize, hide: '0' },
      });

      if (response.data.status) {
        const { record } = response.data.data;
        setPosts((prev) => [...prev, ...record]);
      }
    } catch (error) {
      console.error('加载文章失败:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  /**
   * 加载更多
   */
  const handleLoadMore = () => {
    const nextPage = pageNum + 1;
    setPageNum(nextPage);
    loadPosts(nextPage);
  };

  /**
   * 保存滚动位置（在组件卸载或路径变化前）
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.setItem('homeScrollPosition', String(window.scrollY));
    };

    // 监听滚动，实时保存位置
    const handleScroll = () => {
      if (window.location.pathname === '/') {
        sessionStorage.setItem('homeScrollPosition', String(window.scrollY));
      }
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <div className="snap-y snap-mandatory">
      {/* 横幅 */}
      <Banner anchorRef={anchorRef} />
      
      {/* 锚点 */}
      <div ref={anchorRef} />

      {/* 文章列表 */}
      <div className="snap-start">
        <ul>
          {posts.map((post) => (
            <PostListItem key={post.id} post={post} />
          ))}
        </ul>

        {/* 加载更多 */}
        {posts.length < initialTotal && (
          <div
            className="cursor-pointer py-8 text-center text-slate-950 dark:text-white"
            onClick={handleLoadMore}
          >
            {loadingMore ? '加载中...' : '加载更多'}
          </div>
        )}
      </div>
    </div>
  );
}

