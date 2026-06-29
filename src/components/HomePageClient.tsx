'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import PostListItem from '@/components/PostListItem';
import type { Post } from '@/types';
import type { BookshelfCollection } from '@/components/cyberpunk/furniture/types';
import { homeFeedCopy } from '@/config/site-copy/home';
import { selectStyleText } from '@/lib/site-style/copy';
import { useStyleVariant } from '@/lib/site-style/useStyleVariant';

interface HomePageClientProps {
  posts: Post[];
  hasMore: boolean;
  onLoadMore: () => void;
  collections: BookshelfCollection[];
}

// 滚动位置缓存键名
const SCROLL_CACHE_KEY = 'home_scroll_position';

function Homepage3DBannerFallback() {
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

const Homepage3DBanner = dynamic(() => import('@/components/cyberpunk/Homepage3DBanner'), {
  ssr: false,
  loading: () => <Homepage3DBannerFallback />,
});

/**
 * 首页客户端组件（受控组件）
 * 只负责展示和触发加载更多的回调
 */
export default function HomePageClient({
  posts,
  hasMore,
  onLoadMore,
  collections,
}: HomePageClientProps) {
  const scrollRestoreRef = useRef(false); // 标记滚动是否已恢复
  const postsAnchorRef = useRef<HTMLDivElement>(null);
  const styleVariant = useStyleVariant();
  const isNightStyle = styleVariant === 'night';

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
      <Homepage3DBanner variant={styleVariant} posts={posts} collections={collections} />

      {/* 文章列表 */}
      <div ref={postsAnchorRef} />
      <section className="cyberpunk-log-section">
        <div className="cyberpunk-log-frame mx-auto max-w-6xl px-4 pt-14 md:px-6 md:pt-20">
          <div className="cyberpunk-log-header mb-8 flex flex-col gap-6 border-l border-border-light pl-5 dark:border-cyan-300/35 md:mb-14 md:flex-row md:items-end md:justify-between md:pl-7">
            <div className="flex flex-col gap-3">
              <span className="text-[11px] uppercase tracking-[0.34em] text-sky-700/70 dark:text-cyan-100/55">
                {selectStyleText(homeFeedCopy.kicker, styleVariant)}
              </span>
              <div className="flex flex-col gap-1">
                <span className="hidden font-mono text-4xl font-semibold uppercase tracking-normal text-cyan-100 drop-shadow-[0_0_18px_rgba(34,211,238,0.38)] dark:block md:text-6xl">
                  {selectStyleText(homeFeedCopy.accentTitle, styleVariant)}
                </span>
                <h2 className="text-2xl font-semibold tracking-normal text-text-main-light dark:text-[#ff4dad] md:text-4xl">
                  {selectStyleText(homeFeedCopy.heading, styleVariant)}
                </h2>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-text-muted-light dark:text-slate-400">
                {selectStyleText(homeFeedCopy.description, styleVariant)}
              </p>
            </div>

            <div className="hidden min-w-48 border-t border-cyan-300/25 pt-4 font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-100/55 dark:block">
              <div className="flex items-center justify-between gap-5">
                <span>{selectStyleText(homeFeedCopy.metricLabel, styleVariant)}</span>
                <span className="text-[#ff4dad]">{String(posts.length).padStart(3, '0')}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-5">
                <span>{selectStyleText(homeFeedCopy.statusLabel, styleVariant)}</span>
                <span className="text-cyan-200">
                  {selectStyleText(homeFeedCopy.statusValue, styleVariant)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <ul className={`cyberpunk-log-feed relative mx-auto max-w-6xl px-4 md:px-6 ${isNightStyle ? 'cyberpunk-log-feed--active' : ''}`}>
          {posts.map((post, index) => (
            <PostListItem
              key={post.id}
              post={post}
              index={index}
              variant={isNightStyle ? 'log' : 'default'}
            />
          ))}
        </ul>

        {/* 加载更多 */}
        {hasMore && posts.length > 0 && (
          <div className="mb-10 flex justify-center px-4 pt-6 md:px-6">
            <button
              className="cyberpunk-log-button cursor-pointer rounded-full border border-border-light bg-card-light px-8 py-3 text-sm font-medium text-text-muted-light shadow-sm transition-all hover:border-primary hover:text-primary hover:shadow-md dark:rounded-none dark:border-cyan-300/45 dark:bg-cyan-300/[0.08] dark:px-10 dark:py-4 dark:font-mono dark:text-xs dark:font-semibold dark:uppercase dark:tracking-[0.34em] dark:text-cyan-100/80 dark:shadow-[0_0_28px_rgba(34,211,238,0.08)] dark:hover:border-cyan-200/70 dark:hover:bg-cyan-200/[0.12] dark:hover:text-cyan-50"
              onClick={onLoadMore}
              aria-label={selectStyleText(homeFeedCopy.loadMoreAriaLabel, styleVariant)}
            >
              {selectStyleText(homeFeedCopy.loadMore, styleVariant)}
            </button>
          </div>
        )}

        {/* 已加载全部 */}
        {!hasMore && posts.length > 0 && (
          <div className="py-8 text-center text-xs uppercase tracking-[0.24em] text-text-muted-light dark:font-mono dark:text-cyan-100/35">
            {selectStyleText(homeFeedCopy.complete, styleVariant)}
          </div>
        )}
      </section>
    </div>
  );
}
