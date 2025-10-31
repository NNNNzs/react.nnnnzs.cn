/**
 * 访问量追踪组件（客户端组件）
 * 在客户端静默更新访问量，不影响服务端渲染
 */

'use client';

import React, { useEffect, useState } from 'react';

interface PostVisitorTrackerProps {
  /**
   * 文章ID
   */
  postId: number;
  /**
   * 初始访问量
   */
  initialCount: number;
}

export default function PostVisitorTracker({ postId, initialCount }: PostVisitorTrackerProps) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    // 在客户端更新访问量（静默更新，不显示加载状态）
    const updateVisitor = async () => {
      try {
        // 使用 fetch 而不是 axios，减少依赖
        const response = await fetch(`/api/post/fav?id=${postId}&type=visitors`, {
          method: 'PUT',
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.status && result.data) {
            setCount(result.data.visitors || initialCount + 1);
          }
        }
      } catch (error) {
        console.error('更新访问量失败:', error);
      }
    };

    // 延迟更新，避免阻塞页面渲染
    const timer = setTimeout(updateVisitor, 1000);
    
    return () => clearTimeout(timer);
  }, [postId, initialCount]);

  return <span>{count} 次阅读</span>;
}

