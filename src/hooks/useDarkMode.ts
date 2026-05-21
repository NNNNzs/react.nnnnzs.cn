/**
 * 暗色模式 Hook
 *
 * 负责初始化主题（根据本地存储和系统首选项）并提供切换暗色模式的函数。
 *
 * 使用示例：
 * const { isDark, toggleDark } = useDarkMode();
 */
import { useCallback, useEffect, useState } from "react";

interface UseDarkModeResult {
  /**
   * 是否为暗色模式
   */
  isDark: boolean;
  /**
   * 切换暗色 / 亮色模式
   */
  toggleDark: () => void;
}

/**
 * 暗色模式管理 Hook
 *
 * SSR/Client 初始值固定为 false，避免 hydration mismatch。
 * 客户端 mount 后通过 useEffect 读取真实主题并应用。
 * layout.tsx 中的内联阻塞脚本负责在渲染前设置 dark class，防止 FOUC。
 *
 * @returns 返回当前是否暗色模式以及切换函数
 */
export function useDarkMode(): UseDarkModeResult {
  // SSR/Client 初始值始终一致，避免 hydration mismatch
  const [isDark, setIsDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  const applyTheme = useCallback((dark: boolean) => {
    if (typeof window === "undefined") return;

    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, []);

  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      applyTheme(next);
      return next;
    });
  }, [applyTheme]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      // 客户端 mount 后才读取真实主题
      const theme = localStorage.getItem("theme");
      let dark = false;
      if (theme) {
        dark = theme === "dark";
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        dark = true;
      }
      setIsDark(dark);
      setMounted(true);
      applyTheme(dark);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [applyTheme]);

  return {
    // 未 mounted 前返回 false，与 SSR 保持一致
    isDark: mounted ? isDark : false,
    toggleDark,
  };
}

