'use client';

import React, { useEffect, useRef } from 'react';
import Banner from '@/components/Banner';
import PostListItem from '@/components/PostListItem';
import type { Post } from '@/types';

interface HomePageClientProps {
  posts: Post[];
  hasMore: boolean;
  onLoadMore: () => void;
}

// 滚动位置缓存键名
const SCROLL_CACHE_KEY = 'home_scroll_position';

/**
 * 首页客户端组件（受控组件）
 * 只负责展示和触发加载更多的回调
 */
export default function HomePageClient({ 
  posts,
  hasMore,
  onLoadMore,
}: HomePageClientProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const scrollRestoreRef = useRef(false); // 标记滚动是否已恢复

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
          console.log('保存滚动位置:', window.scrollY);
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
  useEffect(() => {
    // 如果已经恢复过，不再执行
    if (scrollRestoreRef.current) return;

    const restoreScroll = () => {
      // 检查是否在首页
      if (window.location.pathname !== '/') return;

      const savedScroll = sessionStorage.getItem(SCROLL_CACHE_KEY);
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
            onClick={onLoadMore}
          >
            加载更多
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