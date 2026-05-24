'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import PostListItem from '@/components/PostListItem';
import type { Post } from '@/types';
import { useDarkMode } from '@/hooks/useDarkMode';

interface HomePageClientProps {
  posts: Post[];
  hasMore: boolean;
  onLoadMore: () => void;
}

// 滚动位置缓存键名
const SCROLL_CACHE_KEY = 'home_scroll_position';

function CyberpunkBannerFallback() {
  return (
    <div className="relative h-screen overflow-hidden bg-[#f8fafc] dark:bg-[#050611]">
      <div className="cyberpunk-static-fallback" />
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        <div className="cyberpunk-hero-atmosphere" />
        <div className="absolute left-4 right-4 top-[14vh] max-w-5xl md:left-10 lg:left-16">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-sky-900/65 dark:text-cyan-100/65">
            <span className="cyberpunk-kicker">NEON NOMAD / LOADING</span>
            <span className="h-px w-10 bg-sky-500/40 dark:bg-cyan-300/40" />
            <span>VISUAL MODE</span>
          </div>
          <h1 className="cyberpunk-hero-title">NNNNzs</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-700/78 dark:text-slate-200/74 md:text-base">
            Neon Nomad Navigating Night Zones. 记录技术、工具、运维、AI 与生活里的长期思考。
          </p>
        </div>
      </div>
    </div>
  );
}

const CyberpunkBanner = dynamic(() => import('@/components/cyberpunk/CyberpunkBanner'), {
  ssr: false,
  loading: () => <CyberpunkBannerFallback />,
});

/**
 * 首页客户端组件（受控组件）
 * 只负责展示和触发加载更多的回调
 */
export default function HomePageClient({
  posts,
  hasMore,
  onLoadMore,
}: HomePageClientProps) {
  const scrollRestoreRef = useRef(false); // 标记滚动是否已恢复
  const postsAnchorRef = useRef<HTMLDivElement>(null);
  const { isDark: isDarkTheme } = useDarkMode();

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
          sessionStorage.setItem(SCROLL_CACHE_KEY, String(window.scrollY));
        }
      }, 100);
    };

    // 页面卸载前保存
    const handleBeforeUnload = () => {
      sessionStorage.setItem(SCROLL_CACHE_KEY, String(window.scrollY));
    };

    // 页面可见性变化时保存（用户切换标签页）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && window.location.pathname === '/') {
        sessionStorage.setItem(SCROLL_CACHE_KEY, String(window.scrollY));
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
  const restoreScroll = useCallback(() => {
    // 检查是否在首页
    if (window.location.pathname !== '/') return;

    const savedScroll = sessionStorage.getItem(SCROLL_CACHE_KEY);
    if (savedScroll) {
      const scrollY = parseInt(savedScroll, 10);
      if (!Number.isFinite(scrollY)) {
        scrollRestoreRef.current = true;
        return;
      }

      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
        scrollRestoreRef.current = true;
      });
    } else {
      scrollRestoreRef.current = true;
    }
  }, []);

  useEffect(() => {
    // 如果已经恢复过，不再执行
    if (scrollRestoreRef.current) return;

    const frame = requestAnimationFrame(restoreScroll);

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [restoreScroll]);

  return (
    <div className="bg-background-light dark:bg-[#050611]">
      {/* 横幅 */}
      <CyberpunkBanner variant={isDarkTheme ? 'night' : 'day'} posts={posts} />

      {/* 文章列表 */}
      <div ref={postsAnchorRef} />
      <section className="cyberpunk-log-section">
        <div className="mx-auto max-w-5xl px-4 pt-14 md:px-6 md:pt-20">
          <div className="mb-8 flex flex-col gap-3 border-l border-border-light pl-5 dark:border-cyan-300/35 md:mb-12">
            <span className="text-[11px] uppercase tracking-[0.34em] text-sky-700/70 dark:text-cyan-100/55">
              Recent Posts
            </span>
            <h2 className="text-2xl font-semibold tracking-normal text-text-main-light dark:text-slate-100 md:text-4xl">
              最近文章
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-text-muted-light dark:text-slate-400">
              Neon Nomad Navigating Night Zones. 记录技术、工具、运维、AI 与生活里的长期思考。
            </p>
          </div>
        </div>

        <ul className="px-4 md:px-6">
          {posts.map((post, index) => (
            <PostListItem key={post.id} post={post} index={index} />
          ))}
        </ul>

        {/* 加载更多 */}
        {hasMore && posts.length > 0 && (
          <div className="mb-10 flex justify-center pt-6">
            <button
              className="cursor-pointer rounded-full border border-border-light bg-card-light px-8 py-3 text-sm font-medium text-text-muted-light shadow-sm transition-all hover:border-primary hover:text-primary hover:shadow-md dark:rounded-none dark:border-cyan-300/35 dark:bg-cyan-300/[0.08] dark:text-xs dark:font-semibold dark:uppercase dark:tracking-[0.24em] dark:text-cyan-100/75 dark:shadow-[0_0_28px_rgba(34,211,238,0.08)] dark:hover:border-cyan-200/70 dark:hover:bg-cyan-200/[0.12] dark:hover:text-cyan-50"
              onClick={onLoadMore}
            >
              加载更多文章
            </button>
          </div>
        )}

        {/* 已加载全部 */}
        {!hasMore && posts.length > 0 && (
          <div className="py-8 text-center text-xs uppercase tracking-[0.24em] text-text-muted-light dark:text-slate-500">
            已加载全部文章
          </div>
        )}
      </section>
    </div>
  );
}
