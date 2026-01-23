/**
 * 头部导航组件
 * 基于设计稿重构，保留原有的 hover 功能
 */

"use client";

import React, { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Drawer } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { DocSearch } from "@docsearch/react";
import "@docsearch/css";
import HeaderUserMenu from "@/components/HeaderUserMenu";
import { useHeaderStyle } from "@/contexts/HeaderStyleContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentPost } from "@/contexts/CurrentPostContext";
import { useRouteMatch } from "@/hooks/useRouteMatch";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { useConfig } from "@/hooks/useConfig";
import { buildEditPostPath } from "@/lib/routes";

// 导航菜单配置
const navItems = [
  { href: "/", label: "首页", type: "link" as const },
  { href: "/archives", label: "文章", type: "link" as const },
  { href: "/collections", label: "合集", type: "link" as const },
  { href: "/chat", label: "回想", type: "ai-badge" as const },
];

export default function Header() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const scrollBarRef = useRef<HTMLDivElement>(null);

  // 获取 Header 样式配置
  const { headerStyle } = useHeaderStyle();

  // 获取当前登录用户
  const { user } = useAuth();

  // 使用路由匹配 Hook
  const { isPostDetail } = useRouteMatch();

  // 从 Context 获取当前文章信息
  const { currentPost } = useCurrentPost();

  // 暗色模式
  const { isDark, toggleDark } = useDarkMode();

  // 滚动进度与 Header 透明度
  const { scrollProgress, headerOpacity } = useScrollProgress(pathname);

  // 检查是否应该显示编辑按钮
  const shouldShowEditButton =
    isPostDetail && currentPost && user && currentPost.created_by === user.id;

  // 根据滚动进度与透明度更新 CSS 变量
  useEffect(() => {
    if (scrollBarRef.current) {
      scrollBarRef.current.style.setProperty("--percent", `${scrollProgress}%`);
    }
    if (headerRef.current) {
      headerRef.current.style.setProperty(
        "--header-opacity",
        headerOpacity.toString()
      );
    }
  }, [scrollProgress, headerOpacity]);

  // Algolia 配置
  const ALGOLIA_CONFIG_KEYS = [
    "algolia_app_id",
    "algolia_api_key",
    "algolia_index_name",
  ] as const;

  const { values: algoliaConfig } = useConfig(ALGOLIA_CONFIG_KEYS);

  const algoliaAppId = algoliaConfig.algolia_app_id;
  const algoliaApiKey = algoliaConfig.algolia_api_key;
  const algoliaIndexName = algoliaConfig.algolia_index_name;

  return (
    <>
      <header
        ref={headerRef}
        className={`header top-0 z-50 ${
          headerStyle.static
            ? "static bg-card-light dark:bg-card-dark text-text-main-light dark:text-text-main-dark"
            : "fixed backdrop-blur-md bg-card-light/80 dark:bg-card-dark/80 text-text-main-light dark:text-text-main-dark"
        }`}
        style={
          headerStyle.static
            ? undefined
            : ({
                opacity: headerOpacity < 0.1 ? 0 : Math.max(headerOpacity, 0.6),
              } as React.CSSProperties)
        }
      >
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8">
          <div className="flex h-full items-center justify-between">
            {/* 左侧：Logo + 导航 */}
            <div className="flex items-center gap-6">
              {/* Logo */}
              <Link
                href="/"
                className="flex items-center gap-2 text-xl font-bold tracking-tight text-primary hover:opacity-80 transition-opacity"
              >
                <span className="material-symbols-outlined text-2xl">code_blocks</span>
                <span>NNNNzs</span>
              </Link>

              {/* 桌面端导航 */}
              <nav className="hidden md:flex items-center gap-6">
                {navItems.map((item) => {
                  if (item.type === "ai-badge") {
                    // AI Badge 特殊样式
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group/ai flex items-center gap-1.5 px-3 py-1.5 rounded-full
                          bg-indigo-50 dark:bg-indigo-900/20
                          text-indigo-600 dark:text-indigo-400
                          text-sm font-semibold
                          hover:bg-indigo-100 dark:hover:bg-indigo-900/40
                          transition-all border border-indigo-100 dark:border-indigo-800/50"
                      >
                        <span className="material-symbols-outlined text-[18px] group-hover/ai:animate-pulse">
                          psychology
                        </span>
                        {item.label}
                      </Link>
                    );
                  }

                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`h-full inline-block relative text-sm font-medium transition-colors after:absolute after:bottom-0 after:left-0 after:w-full after:h-px after:bg-text-main-light dark:after:bg-text-main-dark ${
                        isActive
                          ? "after:opacity-100 text-text-main-light dark:text-text-main-dark"
                          : "after:opacity-0 hover:after:opacity-50 text-text-muted-light dark:text-text-muted-dark hover:text-primary"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}

                {/* 编辑按钮 - 仅在当前用户是文章创建人时显示 */}
                {shouldShowEditButton && currentPost && (
                  <Link
                    href={buildEditPostPath(currentPost.id)}
                    className="flex items-center gap-1 text-sm font-medium text-text-muted-light dark:text-text-muted-dark hover:text-primary transition-colors"
                  >
                    <EditOutlined />
                    编辑
                  </Link>
                )}
              </nav>
            </div>

            {/* 右侧：搜索 + 主题 + 用户 */}
            <div className="flex items-center gap-3">
              {/* 搜索框 */}
              {algoliaAppId && algoliaApiKey && (
                <div className="hidden md:block">
                  <DocSearch
                    appId={algoliaAppId}
                    apiKey={algoliaApiKey}
                    indexName={algoliaIndexName}
                    translations={{
                      button: {
                        buttonText: "搜索文章 (Ctrl + K)",
                        buttonAriaLabel: "搜索文章",
                      },
                    }}
                  />
                </div>
              )}

              {/* 暗色模式切换 */}
              <button
                onClick={toggleDark}
                className="p-2 rounded-full text-text-muted-light dark:text-text-muted-dark hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
                aria-label="切换暗色模式"
              >
                <span className="material-symbols-outlined dark:hidden">dark_mode</span>
                <span className="material-symbols-outlined hidden dark:block">light_mode</span>
              </button>

              {/* 用户信息 */}
              <Suspense fallback={<div className="w-20 h-8" />}>
                <HeaderUserMenu />
              </Suspense>

              {/* 移动端菜单按钮 */}
              <button
                className="md:hidden p-2 rounded-md text-text-muted-light dark:text-text-muted-dark hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
                onClick={() => setDrawerOpen(true)}
              >
                <span className="material-symbols-outlined">menu</span>
              </button>
            </div>
          </div>
        </div>

        {/* 滚动进度条 */}
        <div
          ref={scrollBarRef}
          className="absolute bottom-0 h-px bg-slate-500"
          style={{
            width: `${scrollProgress}%`,
          }}
        ></div>
      </header>

      {/* 移动端抽屉菜单 */}
      <Drawer
        title="菜单"
        placement="right"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        className="md:hidden"
      >
        <div className="flex flex-col space-y-4">
          {/* 导航项 */}
          {navItems.map((item) => {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="text-text-main-light dark:text-text-main-dark mb-2"
                onClick={() => setDrawerOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}

          {/* 编辑按钮 - 在移动端抽屉中显示 */}
          {shouldShowEditButton && currentPost && (
            <Link
              href={buildEditPostPath(currentPost.id)}
              className="text-text-main-light dark:text-text-main-dark mb-2 flex items-center gap-2"
              onClick={() => setDrawerOpen(false)}
            >
              <EditOutlined />
              编辑
            </Link>
          )}

          {/* 暗色模式切换 - 在抽屉中也添加 */}
          <button
            onClick={() => {
              toggleDark();
              setDrawerOpen(false);
            }}
            className="text-left text-text-main-light dark:text-text-main-dark mb-2 flex items-center gap-2"
          >
            <span className="material-symbols-outlined">
              {isDark ? "light_mode" : "dark_mode"}
            </span>
            {isDark ? "切换到亮色" : "切换到暗色"}
          </button>
        </div>
      </Drawer>
    </>
  );
}
