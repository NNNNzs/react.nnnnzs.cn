/**
 * 头部导航组件
 * 基于设计稿重构，保留原有的 hover 功能
 */

"use client";

import React, { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Drawer } from "antd";
import { EditOutlined, CodeOutlined, BulbOutlined, MenuOutlined } from "@ant-design/icons";
import { DocSearch } from "@docsearch/react";
import "@docsearch/css";
import HeaderUserMenu from "@/components/HeaderUserMenu";
import { headerCopy } from "@/config/site-copy/header";
import { useHeaderStyle } from "@/contexts/HeaderStyleContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentPost } from "@/contexts/CurrentPostContext";
import { useRouteMatch } from "@/hooks/useRouteMatch";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { useConfig } from "@/hooks/useConfig";
import { selectStyleText } from "@/lib/site-style/copy";
import { getStyleVariantFromThemeMode } from "@/lib/site-style/variant";
import { buildEditPostPath } from "@/lib/routes";

// 导航菜单配置
const navItems = [
  { href: "/", labelKey: "navHome", type: "link" as const },
  { href: "/archives", labelKey: "navArchives", type: "link" as const },
  { href: "/collections", labelKey: "navCollections", type: "link" as const },
  { href: "/chat", labelKey: "navChat", type: "ai-badge" as const },
] as const;

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
  const styleVariant = getStyleVariantFromThemeMode(isDark ? "dark" : "light");

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
                <CodeOutlined className="text-2xl" />
                <span>NNNNzs</span>
              </Link>

              {/* 桌面端导航 */}
	              <nav className="hidden md:flex items-center gap-6">
	                {navItems.map((item) => {
                  const label = selectStyleText(headerCopy[item.labelKey], styleVariant);

	                  if (item.type === "ai-badge") {
	                    // AI Badge 特殊样式
	                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        suppressHydrationWarning
                        className="group/ai flex items-center gap-1.5 px-3 py-1.5 rounded-full
                          bg-indigo-50 dark:bg-indigo-900/20
                          text-indigo-600 dark:text-indigo-400
                          text-sm font-semibold
                          hover:bg-indigo-100 dark:hover:bg-indigo-900/40
                          transition-all border border-indigo-100 dark:border-indigo-800/50"
	                      >
	                        <BulbOutlined className="text-[18px] group-hover/ai:animate-pulse" />
	                        {label}
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
	                      {label}
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
	                    {selectStyleText(headerCopy.editPost, styleVariant)}
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
	                        buttonText: selectStyleText(headerCopy.searchButton, styleVariant),
	                        buttonAriaLabel: selectStyleText(headerCopy.searchAriaLabel, styleVariant),
	                      },
	                    }}
	                  />
                </div>
              )}

              {/* GitHub */}
              <a
                href="https://github.com/NNNNzs/react.nnnnzs.cn"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full text-text-muted-light dark:text-text-muted-dark hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-text-main-light dark:hover:text-text-main-dark transition-colors"
                aria-label="GitHub"
              >
                <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-current">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>

              {/* 暗色模式切换 - 赛博朋克风格 */}
	              <button
	                onClick={toggleDark}
	                className="relative p-2 rounded-full text-text-muted-light dark:text-text-muted-dark hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-text-main-light dark:hover:text-text-main-dark transition-colors focus:outline-none"
	                aria-label={selectStyleText(headerCopy.themeToggleAriaLabel, styleVariant)}
	              >
                {/* 太阳 */}
                <svg
                  viewBox="0 0 24 24"
                  className={`w-[18px] h-[18px] transition-all duration-300 ${isDark ? "rotate-90 scale-0 opacity-0 absolute" : "rotate-0 scale-100 opacity-100"}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                {/* 月亮 */}
                <svg
                  viewBox="0 0 24 24"
                  className={`w-[18px] h-[18px] transition-all duration-300 drop-shadow-[0_0_6px_rgba(167,139,250,0.6)] ${isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0 absolute"}`}
                  fill="none"
                  stroke="#a78bfa"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
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
                <MenuOutlined />
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
	        title={selectStyleText(headerCopy.drawerTitle, styleVariant)}
	        placement="right"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        className="md:hidden"
      >
        <div className="flex flex-col space-y-4">
	          {/* 导航项 */}
	          {navItems.map((item) => {
              const label = selectStyleText(headerCopy[item.labelKey], styleVariant);

	            return (
	              <Link
                key={item.href}
                href={item.href}
                className="text-text-main-light dark:text-text-main-dark mb-2"
                onClick={() => setDrawerOpen(false)}
	              >
	                {label}
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
	              {selectStyleText(headerCopy.editPost, styleVariant)}
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
            {isDark ? (
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
            )}
	            {isDark
	              ? selectStyleText(headerCopy.switchToDay, styleVariant)
	              : selectStyleText(headerCopy.switchToNight, styleVariant)}
	          </button>
        </div>
      </Drawer>
    </>
  );
}
