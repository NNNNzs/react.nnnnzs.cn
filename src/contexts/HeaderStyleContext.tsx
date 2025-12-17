/**
 * Header 样式控制 Context
 * 用于在页面中控制 Header 的定位和透明度
 */

"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface HeaderStyle {
  static: boolean; // 是否使用静态定位（true=static，false=fixed）
  alwaysVisible: boolean; // 是否始终显示（不透明）
}

interface HeaderStyleContextType {
  headerStyle: HeaderStyle;
  setHeaderStyle: (style: HeaderStyle) => void;
  resetHeaderStyle: () => void;
}

const HeaderStyleContext = createContext<HeaderStyleContextType | undefined>(
  undefined
);

/**
 * HeaderStyleProvider 组件
 * 提供 Header 样式控制的上下文
 */
export function HeaderStyleProvider({ children }: { children: ReactNode }) {
  const [headerStyle, setHeaderStyle] = useState<HeaderStyle>({
    static: false,
    alwaysVisible: false,
  });

  /**
   * 重置 Header 样式为默认值
   */
  const resetHeaderStyle = () => {
    setHeaderStyle({
      static: false,
      alwaysVisible: false,
    });
  };

  return (
    <HeaderStyleContext.Provider
      value={{ headerStyle, setHeaderStyle, resetHeaderStyle }}
    >
      {children}
    </HeaderStyleContext.Provider>
  );
}

/**
 * 使用 Header 样式 Hook
 * @returns Header 样式控制对象
 */
export function useHeaderStyle() {
  const context = useContext(HeaderStyleContext);
  if (!context) {
    throw new Error(
      "useHeaderStyle must be used within a HeaderStyleProvider"
    );
  }
  return context;
}
