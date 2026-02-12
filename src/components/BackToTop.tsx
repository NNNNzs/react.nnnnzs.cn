/**
 * 返回顶部按钮组件
 * 基于设计稿重构
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowUpOutlined } from "@ant-design/icons";

export default function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);

  // 使用 useCallback 稳定函数引用
  const toggleVisibility = useCallback(() => {
    setIsVisible(window.pageYOffset > 300);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", toggleVisibility, { passive: true });
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, [toggleVisibility]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, []);

  return (
    <>
      {isVisible && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 p-3 rounded-full bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-lg border border-slate-200 dark:border-slate-700 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-600 dark:hover:border-blue-400 transition-all hidden md:flex items-center justify-center group z-50"
          aria-label="返回顶部"
        >
          <ArrowUpOutlined className="group-hover:-translate-y-1 transition-transform" />
        </button>
      )}
    </>
  );
}
