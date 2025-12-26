'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import Banner from '@/components/Banner';
import PostListItem from '@/components/PostListItem';
import type { Post, PageQueryRes } from '@/types';

interface HomePageClientProps {
  initialPosts: Post[];
  initialTotal: number;
}

// 缓存键名常量
const CACHE_KEYS = {
  POSTS: 'home_posts_cache',
  PAGE_NUM: 'home_page_num_cache',
  TOTAL: 'home_total_cache',
  SCROLL: 'home_scroll_position',
} as const;

// 缓存过期时间（毫秒），10分钟
const CACHE_EXPIRY = 10 * 60 * 1000;

/**
 * 从缓存加载数据
 */
const loadFromCache = (): { posts: Post[]; pageNum: number; total: number } | null => {
  try {
    const cachedPosts = sessionStorage.getItem(CACHE_KEYS.POSTS);
    const cachedPageNum = sessionStorage.getItem(CACHE_KEYS.PAGE_NUM);
    const cachedTotal = sessionStorage.getItem(CACHE_KEYS.TOTAL);

    if (cachedPosts && cachedPageNum && cachedTotal) {
      const posts = JSON.parse(cachedPosts);
      const pageNum = parseInt(cachedPageNum, 10);
      const total = parseInt(cachedTotal, 10);
      
      // 检查缓存是否过期
      const lastUpdate = posts[0]?._timestamp || Date.now();
      if (Date.now() - lastUpdate > CACHE_EXPIRY) {
        console.log('缓存已过期');
        clearCache();
        return null;
      }

      return { posts, pageNum, total };
    }
  } catch (error) {
    console.error('读取缓存失败:', error);
    clearCache();
  }
  return null;
};

/**
 * 保存数据到缓存
 */
const saveToCache = (posts: Post[], pageNum: number, total: number) => {
  try {
    // 为每篇文章添加时间戳，用于过期检查
    const postsWithTimestamp = posts.map(post => ({
      ...post,
      _timestamp: Date.now(),
    }));

    sessionStorage.setItem(CACHE_KEYS.POSTS, JSON.stringify(postsWithTimestamp));
    sessionStorage.setItem(CACHE_KEYS.PAGE_NUM, String(pageNum));
    sessionStorage.setItem(CACHE_KEYS.TOTAL, String(total));
  } catch (error) {
    console.error('保存缓存失败:', error);
  }
};

/**
 * 清除缓存
 */
const clearCache = () => {
  sessionStorage.removeItem(CACHE_KEYS.POSTS);
  sessionStorage.removeItem(CACHE_KEYS.PAGE_NUM);
  sessionStorage.removeItem(CACHE_KEYS.TOTAL);
};

export default function HomePageClient({ initialPosts, initialTotal }: HomePageClientProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 20;
  const anchorRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef(false);
  const scrollRestoreRef = useRef(false); // 标记滚动是否已恢复

  /**
   * 加载文章列表
   */
  const loadPosts = useCallback(async (page: number) => {
    try {
      setLoadingMore(true);

      const response = await axios.get<{
        status: boolean;
        data: PageQueryRes<Post>;
      }>('/api/post/list', {
        params: { pageNum: page, pageSize, hide: '0' },
      });

      if (response.data.status) {
        const { record, total } = response.data.data;
        const newPosts = [...posts, ...record];
        
        setPosts(newPosts);
        setHasMore(newPosts.length < total);
        
        // 保存到缓存
        saveToCache(newPosts, page, total);
      }
    } catch (error) {
      console.error('加载文章失败:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [posts]);

  /**
   * 加载更多
   */
  const handleLoadMore = useCallback(() => {
    const nextPage = pageNum + 1;
    setPageNum(nextPage);
    loadPosts(nextPage);
  }, [pageNum, loadPosts]);

  /**
   * 恢复缓存数据
   */
  useEffect(() => {
    if (isRestoringRef.current) return;
    isRestoringRef.current = true;

    const cached = loadFromCache();
    if (cached) {
      console.log('恢复缓存数据:', {
        posts: cached.posts.length,
        pageNum: cached.pageNum,
        total: cached.total,
      });
      
      setPosts(cached.posts);
      setPageNum(cached.pageNum);
      setHasMore(cached.posts.length < cached.total);
    } else {
      // 没有缓存，使用初始数据
      setPosts(initialPosts);
      setPageNum(1);
      setHasMore(initialPosts.length < initialTotal);
    }
  }, [initialPosts, initialTotal]);

  /**
   * 保存滚动位置 - 实时监听
   */
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      // 清除之前的定时器
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // 延迟保存，避免频繁操作
      scrollTimeout = setTimeout(() => {
        if (window.location.pathname === '/') {
          sessionStorage.setItem(CACHE_KEYS.SCROLL, String(window.scrollY));
          console.log('保存滚动位置:', window.scrollY);
        }
      }, 100);
    };

    // 页面卸载前保存
    const handleBeforeUnload = () => {
      sessionStorage.setItem(CACHE_KEYS.SCROLL, String(window.scrollY));
    };

    // 页面可见性变化时保存（用户切换标签页）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && window.location.pathname === '/') {
        sessionStorage.setItem(CACHE_KEYS.SCROLL, String(window.scrollY));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, []);

  /**
   * 恢复滚动位置 - 只执行一次
   */
  useEffect(() => {
    // 如果已经恢复过，不再执行
    if (scrollRestoreRef.current) return;

    const restoreScroll = () => {
      // 检查是否在首页
      if (window.location.pathname !== '/') return;

      const savedScroll = sessionStorage.getItem(CACHE_KEYS.SCROLL);
      if (savedScroll) {
        const scrollY = parseInt(savedScroll, 10);
        
        // 使用 requestAnimationFrame 确保在浏览器绘制后执行
        requestAnimationFrame(() => {
          // 额外延迟确保所有内容都已渲染
          setTimeout(() => {
            window.scrollTo(0, scrollY);
            console.log('已恢复滚动位置:', scrollY);
            scrollRestoreRef.current = true;
          }, 50);
        });
      } else {
        scrollRestoreRef.current = true;
      }
    };

    // 多种时机尝试恢复
    // 1. 立即尝试（可能内容已准备好）
    restoreScroll();

    // 2. 延迟恢复（确保内容渲染完成）
    const timer1 = setTimeout(restoreScroll, 100);
    
    // 3. 图片加载完成后恢复
    const handleLoad = () => {
      setTimeout(restoreScroll, 50);
    };
    window.addEventListener('load', handleLoad);

    // 4. 如果有图片，监听图片加载
    const images = document.querySelectorAll('img');
    let loadedCount = 0;
    const totalImages = images.length;

    if (totalImages > 0) {
      images.forEach(img => {
        if (img.complete) {
          loadedCount++;
        } else {
          img.addEventListener('load', () => {
            loadedCount++;
            if (loadedCount === totalImages) {
              setTimeout(restoreScroll, 50);
            }
          });
          img.addEventListener('error', () => {
            loadedCount++;
            if (loadedCount === totalImages) {
              setTimeout(restoreScroll, 50);
            }
          });
        }
      });
    }

    return () => {
      clearTimeout(timer1);
      window.removeEventListener('load', handleLoad);
    };
  }, [posts]); // 依赖 posts，当文章列表变化时也尝试恢复

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
        {hasMore && posts.length > 0 && (
          <div
            className="cursor-pointer py-8 text-center text-slate-950 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={handleLoadMore}
          >
            {loadingMore ? '加载中...' : '加载更多'}
          </div>
        )}

        {/* 已加载全部 */}
        {!hasMore && posts.length > 0 && (
          <div className="py-8 text-center text-slate-500 dark:text-slate-400">
            已加载全部文章
          </div>
        )}
      </div>
    </div>
  );
}