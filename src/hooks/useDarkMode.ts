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
 * @returns 返回当前是否暗色模式以及切换函数
 */
export function useDarkMode(): UseDarkModeResult {
  // 检测是否在服务端渲染环境
  const isServer = typeof window === "undefined";

  // 从 localStorage 读取初始主题（服务端和客户端保持一致）
  const getInitialTheme = (): boolean => {
    if (isServer) {
      // SSR 时默认返回 false，避免 hydration mismatch
      return false;
    }
    const theme = localStorage.getItem("theme");
    if (theme) {
      return theme === "dark";
    }
    // 检查系统偏好
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  };

  const [isDark, setIsDark] = useState<boolean>(getInitialTheme);

  const applyTheme = useCallback((dark: boolean) => {
    if (typeof window === "undefined") return; // SSR 跳过 DOM 操作

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
    // 只在客户端初始化主题
    if (isServer) return;

    const initTheme = () => {
      const theme = localStorage.getItem("theme");
      const dark = theme === "dark";
      setIsDark(dark);
      applyTheme(dark);
    };

    // 使用 requestAnimationFrame 避免同步 setState
    requestAnimationFrame(initTheme);
  }, [applyTheme]);

  return {
    isDark,
    toggleDark,
  };
}


