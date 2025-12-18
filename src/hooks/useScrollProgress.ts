/**
 * 滚动进度与 Header 透明度 Hook
 *
 * 负责监听窗口滚动事件，计算页面滚动进度和 Header 透明度。
 *
 * 使用示例：
 * const { scrollProgress, headerOpacity } = useScrollProgress(pathname);
 */
import { useEffect, useState } from "react";

interface UseScrollProgressResult {
  /**
   * 页面滚动进度，0 - 100
   */
  scrollProgress: number;
  /**
   * Header 透明度，0 - 1
   */
  headerOpacity: number;
}

/**
 * 基于窗口滚动位置计算滚动进度和 Header 透明度
 *
 * @param dependency 通常传入 pathname，当路由变化时重新计算
 * @returns 滚动进度和 Header 透明度
 */
export function useScrollProgress(
  dependency: unknown
): UseScrollProgressResult {
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [headerOpacity, setHeaderOpacity] = useState<number>(0);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // 计算滚动进度
      const percent = ((y > 0 ? y + windowHeight : 0) / documentHeight) * 100;
      setScrollProgress(percent);

      // 计算 header 透明度
      const opacity = Math.min(y / windowHeight, 1);
      setHeaderOpacity(opacity);
    };

    window.addEventListener("scroll", handleScroll);
    // 初始调用，确保路径变化后状态正确
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [dependency]);

  return {
    scrollProgress,
    headerOpacity,
  };
}


