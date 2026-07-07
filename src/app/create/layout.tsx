"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Drawer, Layout, Menu, message, Tag } from "antd";
import type { MenuProps } from "antd";
import {
  AppstoreOutlined,
  CalendarOutlined,
  DashboardOutlined,
  FileTextOutlined,
  FormOutlined,
  MenuOutlined,
  PictureOutlined,
  ReadOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useHeaderStyle } from "@/contexts/HeaderStyleContext";
import { useBreakpoint } from "@/hooks/useBreakpoint";

const { Content, Sider } = Layout;

const MOBILE_BREAKPOINT = 768;
const CREATE_LAYOUT_HEIGHT = "h-[calc(100vh-var(--header-height))]";

const createRoutes = [
  "/create",
  "/create/drafts",
  "/create/assets",
  "/create/topics",
  "/create/calendar",
  "/create/review",
  "/create/templates",
];

function getSelectedKey(pathname: string) {
  const matched = createRoutes
    .filter((route) => pathname === route || pathname.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length)[0];

  return matched || "/create";
}

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { setHeaderStyle, resetHeaderStyle } = useHeaderStyle();
  const { isMobile } = useBreakpoint(MOBILE_BREAKPOINT);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectedMenuKeys = useMemo(() => [getSelectedKey(pathname)], [pathname]);

  const menuItems: MenuProps["items"] = useMemo(
    () => [
      {
        key: "/create",
        icon: <DashboardOutlined />,
        label: "工作台",
      },
      {
        key: "/create/drafts",
        icon: <FileTextOutlined />,
        label: "草稿库",
      },
      {
        key: "/create/assets",
        icon: <PictureOutlined />,
        label: "素材库",
      },
      {
        key: "/create/topics",
        icon: <ReadOutlined />,
        label: "选题库",
      },
      {
        key: "/create/calendar",
        icon: <CalendarOutlined />,
        label: "发布日历",
      },
      {
        key: "/create/review",
        icon: <AppstoreOutlined />,
        label: "复盘数据",
      },
      {
        key: "/create/templates",
        icon: <ToolOutlined />,
        label: "模板管理",
      },
    ],
    [],
  );

  useEffect(() => {
    if (!loading && !user) {
      message.warning("请先登录");
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [loading, pathname, router, user]);

  useEffect(() => {
    const prefetchRoutes = async () => {
      for (const route of createRoutes) {
        try {
          await router.prefetch(route);
        } catch (error) {
          console.warn(`Failed to prefetch route: ${route}`, error);
        }
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      (window as Window & { requestIdleCallback: (callback: () => void) => void }).requestIdleCallback(() => {
        void prefetchRoutes();
      });
      return;
    }

    const timer = setTimeout(() => {
      void prefetchRoutes();
    }, 1000);

    return () => clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    document.body.classList.add("admin-light-page");
    setHeaderStyle({
      static: true,
      alwaysVisible: true,
    });

    return () => {
      document.body.classList.remove("admin-light-page");
      resetHeaderStyle();
    };
  }, [resetHeaderStyle, setHeaderStyle]);

  const handleMenuClick: NonNullable<MenuProps["onClick"]> = useCallback(
    (event) => {
      router.push(event.key);
      if (isMobile) {
        setDrawerOpen(false);
      }
    },
    [isMobile, router],
  );

  if (loading || !user) {
    return (
      <div className={`admin-light-shell flex ${CREATE_LAYOUT_HEIGHT} items-center justify-center bg-slate-50 text-slate-950`}>
        <div>加载中...</div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <Layout className={`admin-light-shell ${CREATE_LAYOUT_HEIGHT} bg-slate-50 text-slate-950`}>
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-slate-100"
            aria-label="打开内容创作菜单"
          >
            <MenuOutlined className="text-lg" />
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-800">内容创作中台</div>
            <div className="text-xs text-slate-500">/create</div>
          </div>
        </div>

        <Content className="flex-1 overflow-hidden bg-slate-50 px-3 py-4">
          {children}
        </Content>

        <Drawer
          title="内容创作中台"
          placement="left"
          onClose={() => setDrawerOpen(false)}
          open={drawerOpen}
          size={280}
          rootClassName="admin-light-drawer"
          styles={{
            body: { padding: 0 },
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={selectedMenuKeys}
            items={menuItems}
            onClick={handleMenuClick}
            className="border-r-0"
          />
        </Drawer>
      </Layout>
    );
  }

  return (
    <Layout className={`admin-light-shell ${CREATE_LAYOUT_HEIGHT} bg-slate-50 text-slate-950`}>
      <Sider
        width={220}
        className="admin-light-sider bg-white"
        theme="light"
        style={{
          overflow: "auto",
          height: "calc(100vh - var(--header-height))",
          position: "fixed",
          left: 0,
          top: "var(--header-height)",
          bottom: 0,
        }}
      >
        <div className="flex h-16 items-center justify-center border-b border-slate-200">
          <div className="min-w-0 text-center">
            <div className="flex items-center justify-center gap-2 text-base font-semibold text-slate-900">
              <FormOutlined />
              <span>内容创作</span>
            </div>
            <Tag className="mt-1" color="magenta">create</Tag>
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedMenuKeys}
          items={menuItems}
          onClick={handleMenuClick}
          className="admin-light-menu h-[calc(100vh-var(--header-height)-64px)] border-r-0"
        />
      </Sider>
      <Layout className="ml-[220px] h-full bg-slate-50">
        <Content className="h-full overflow-hidden bg-slate-50 px-6 py-8">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
