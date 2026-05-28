/**
 * 暗色模式 Hook
 *
 * 以模块级主题存储作为单一数据源，避免 Header、首页预览和其他组件各自
 * 持有一份彼此不同步的暗色状态。
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

type ThemeMode = "light" | "dark";

interface UseDarkModeResult {
  isDark: boolean;
  toggleDark: () => void;
}

const THEME_STORAGE_KEY = "theme";
const THEME_CHANGE_EVENT = "themechange";
const THEME_STORAGE_EVENT = "storage";

let currentTheme: ThemeMode = "light";
let initialized = false;
const listeners = new Set<() => void>();

const getSystemPreference = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const readStoredTheme = (): ThemeMode => {
  if (typeof window === "undefined") {
    return currentTheme;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme;
  }

  return getSystemPreference();
};

const notifyListeners = (): void => {
  listeners.forEach((listener) => listener());
};

const applyThemeToDocument = (theme: ThemeMode): void => {
  if (typeof document === "undefined") return;

  document.documentElement.classList.toggle("dark", theme === "dark");
};

const setTheme = (theme: ThemeMode): void => {
  currentTheme = theme;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  applyThemeToDocument(theme);
  notifyListeners();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }
};

const ensureInitialized = (): void => {
  if (initialized || typeof window === "undefined") return;

  currentTheme = readStoredTheme();
  applyThemeToDocument(currentTheme);
  initialized = true;
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): boolean => currentTheme === "dark";

const getServerSnapshot = (): boolean => false;

if (typeof window !== "undefined") {
  currentTheme = readStoredTheme();
  initialized = true;
  applyThemeToDocument(currentTheme);
}

export function useDarkMode(): UseDarkModeResult {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    ensureInitialized();

    const frame = window.requestAnimationFrame(() => {
      setMounted(true);
    });

    const handleThemeChange = (): void => {
      const nextTheme = readStoredTheme();
      if (nextTheme !== currentTheme) {
        currentTheme = nextTheme;
        applyThemeToDocument(currentTheme);
        notifyListeners();
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.addEventListener(THEME_STORAGE_EVENT, handleThemeChange);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
      window.removeEventListener(THEME_STORAGE_EVENT, handleThemeChange);
    };
  }, []);

  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleDark = useCallback(() => {
    setTheme(currentTheme === "dark" ? "light" : "dark");
  }, []);

  return {
    isDark: mounted ? isDark : false,
    toggleDark,
  };
}
