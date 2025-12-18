/**
 * 当前文章 Context
 * 用于在文章详情页和 Header 组件之间传递文章信息
 */

"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import type { Post } from "@/types";

interface CurrentPostContextType {
  currentPost: Post | null;
  setCurrentPost: (post: Post | null) => void;
}

const CurrentPostContext = createContext<CurrentPostContextType | undefined>(
  undefined
);

/**
 * CurrentPostProvider 组件
 * 提供当前文章信息的上下文
 */
export function CurrentPostProvider({ children }: { children: ReactNode }) {
  const [currentPost, setCurrentPost] = useState<Post | null>(null);

  return (
    <CurrentPostContext.Provider value={{ currentPost, setCurrentPost }}>
      {children}
    </CurrentPostContext.Provider>
  );
}

/**
 * 使用当前文章 Hook
 * @returns 当前文章信息和控制函数
 */
export function useCurrentPost() {
  const context = useContext(CurrentPostContext);
  if (!context) {
    throw new Error(
      "useCurrentPost must be used within a CurrentPostProvider"
    );
  }
  return context;
}

