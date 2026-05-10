/**
 * 响应式断点检测 Hook
 * 检测屏幕宽度是否小于指定断点（默认 768px）
 * 使用 useEffect + matchMedia 避免 SSR hydration 不匹配
 */

"use client";

import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

export function useBreakpoint(breakpoint: number = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mql.matches);

    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return { isMobile };
}
