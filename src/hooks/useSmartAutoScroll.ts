"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * 智能自动滚动到底部。
 *
 * 仅当用户当前已停在（接近）底部时，才在内容更新时自动滚到底部；
 * 用户上翻浏览历史时不强制拉回，避免打断阅读。
 *
 * @param containerRef 滚动容器 ref
 * @param active 是否处于需要自动滚动的状态（如流式输出中）
 * @param deps 触发滚动检查的内容依赖（通常是消息列表）
 * @param threshold 判定「接近底部」的距离阈值（px）
 *
 * @returns onScroll 绑定到容器的滚动事件 handler
 */
export function useSmartAutoScroll(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  deps: React.DependencyList = [],
  threshold = 32,
): {
  onScroll: (event: React.UIEvent<HTMLElement>) => void;
} {
  const shouldAutoScrollRef = useRef(true);

  const isNearBottom = useCallback(
    (element: HTMLElement) => {
      const distanceToBottom =
        element.scrollHeight - element.scrollTop - element.clientHeight;
      return distanceToBottom <= threshold;
    },
    [threshold],
  );

  const onScroll = useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      shouldAutoScrollRef.current = isNearBottom(event.currentTarget);
    },
    [isNearBottom],
  );

  useEffect(() => {
    if (!containerRef.current || !active || !shouldAutoScrollRef.current) return;
    requestAnimationFrame(() => {
      if (containerRef.current && shouldAutoScrollRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { onScroll };
}
