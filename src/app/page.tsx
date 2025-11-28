/**
 * 首页 - 文章列表
 * 参考 nnnnzs.cn/pages/index.vue 的设计
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Spin } from 'antd';
import axios from 'axios';
import Banner from '@/components/Banner';
import PostListItem from '@/components/PostListItem';
import type { Post, PageQueryRes } from '@/types';

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const pageSize = 20;
  const anchorRef = useRef<HTMLDivElement>(null);

  /**
   * 加载文章列表
   */
  const loadPosts = async (page: number, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const response = await axios.get<{
        status: boolean;
        data: PageQueryRes<Post>;
      }>('/api/post/list', {
        params: { pageNum: page, pageSize, hide: '0' },
      });

      if (response.data.status) {
        const { record } = response.data.data;
        if (append) {
          setPosts((prev) => [...prev, ...record]);
        } else {
          setPosts(record);
        }
      }
    } catch (error) {
      console.error('加载文章失败:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  /**
   * 加载更多
   */
  const handleLoadMore = () => {
    const nextPage = pageNum + 1;
    setPageNum(nextPage);
    loadPosts(nextPage, true);
  };

  /**
   * 初始化加载
   */
  useEffect(() => {
    loadPosts(1);
  }, []);

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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

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
        <div
          className="cursor-pointer py-8 text-center text-slate-950 dark:text-white"
          onClick={handleLoadMore}
        >
          {loadingMore ? '加载中...' : '加载更多'}
        </div>
      </div>
    </div>
  );
}
