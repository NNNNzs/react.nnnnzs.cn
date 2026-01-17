/**
 * 头部导航组件
 */

"use client";

import React, { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Drawer } from "antd";
import { MenuOutlined, EditOutlined } from "@ant-design/icons";
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

export default function Header() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const returnTopRef = useRef<HTMLDivElement>(null);
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

  // 返回顶部
  const returnTop = () => {
    returnTopRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  };

  // 统一的导航菜单配置 - 只维护一份数据
  const navItems = [
    { href: "/chat", label: "回想", type: "link" as const },
  ];

  // Algolia 配置 - 使用通用配置 Hook 获取
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
      <div ref={returnTopRef}></div>
      <header
        ref={headerRef}
        className={`header top-0 z-999 ${
          headerStyle.static
            ? "static bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            : "fixed backdrop-blur-md bg-white text-slate-900 dark:bg-slate-700 dark:text-white"
        }`}
        style={
          headerStyle.static
            ? undefined
            : ({
                opacity: headerOpacity < 0.1 ? 0 : Math.max(headerOpacity, 0.6),
              } as React.CSSProperties)
        }
      >
        <div className="container mx-auto h-full px-4">
          <div className="mx-auto h-full menu flex items-center justify-between leading-8">
            {/* Logo */}
            <Link href="/" className="text-xl text-center align-bottom">
              NNNNzs
            </Link>

            {/* 桌面端导航 */}
            <div className="hidden md:flex flex-row gap-2 justify-between items-center category w-auto">
              {/* 搜索框 */}
              {algoliaAppId && algoliaApiKey && (
                <div className="flex items-center">
                  <DocSearch
                    appId={algoliaAppId}
                    apiKey={algoliaApiKey}
                    indexName={algoliaIndexName}
                    translations={{
                      button: {
                        buttonText: "搜索",
                        buttonAriaLabel: "搜索",
                      },
                    }}
                  />
                </div>
              )}

              {/* 导航菜单 - 只显示链接类型 */}
              <ul className="h-full flex items-center">
                {navItems
                  .filter((item) => item.type === "link")
                  .map((item) => (
                    <li key={item.href} className="h-full inline-block mr-4">
                      <Link
                        href={item.href}
                        className={`h-full inline-block relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-px after:bg-slate-900 dark:after:bg-white ${
                          pathname === item.href
                            ? "after:opacity-100"
                            : "after:opacity-0 hover:after:opacity-50"
                        } transition-opacity`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}

                {/* 编辑按钮 - 仅在当前用户是文章创建人时显示 */}
                {shouldShowEditButton && currentPost && (
                  <li className="h-full mr-4">
                    <Link
                      href={buildEditPostPath(currentPost.id)}
                      className="h-full flex items-center gap-1 relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-px after:bg-slate-900 dark:after:bg-white after:opacity-0 hover:after:opacity-50 transition-opacity"
                    >
                      <EditOutlined />
                      编辑
                    </Link>
                  </li>
                )}
              </ul>

              {/* 暗色模式切换 */}
              <button
                onClick={toggleDark}
                className="h-full align-middle flex items-center px-2 hover:opacity-70 transition-opacity"
                aria-label="切换暗色模式"
              >
                {isDark ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                )}
              </button>
            

              {/* 用户信息 */}
              <Suspense fallback={<div className="w-20 h-8" />}>
                <HeaderUserMenu />
              </Suspense>
            </div>

            {/* 移动端菜单按钮 */}
            <div
              className="w-4 h-4 md:hidden cursor-pointer"
              onClick={() => setDrawerOpen(true)}
            >
              <MenuOutlined />
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
          {/* 所有导航项 - 使用统一的数据源 */}
          {navItems.map((item) => {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="text-black dark:text-white mb-2"
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
              className="text-black dark:text-white mb-2 flex items-center gap-2"
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
            className="text-left text-black dark:text-white mb-2 flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isDark ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              )}
            </svg>
            {isDark ? "切换到亮色" : "切换到暗色"}
          </button>
        </div>
      </Drawer>

      {/* 返回顶部按钮 */}
      <div
        onClick={returnTop}
        className="fixed bottom-4 right-5 border rounded shadow hover:shadow-lg w-8 h-8 bg-white cursor-pointer flex justify-center items-center dark:bg-slate-800 dark:text-white z-\[99\]"
      >
        <svg
          className="w-5 h-5 dark:text-white dark:fill-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      </div>
    </>
  );
}
