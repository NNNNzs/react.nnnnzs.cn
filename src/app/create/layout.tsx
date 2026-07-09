"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Layout, message } from "antd";
import type { MenuProps } from "antd";
import {
  AppstoreOutlined,
  CalendarOutlined,
  DashboardOutlined,
  FileTextOutlined,
  FormOutlined,
  PictureOutlined,
  ReadOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { CONTENT_VIEW } from "@/constants/permissions";
import { useAuth } from "@/contexts/AuthContext";
import { useHeaderStyle } from "@/contexts/HeaderStyleContext";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import AdminSidebar, {
  ADMIN_SIDEBAR_COLLAPSED_WIDTH,
} from "@/components/admin/AdminSidebar";

const { Content } = Layout;

const MOBILE_BREAKPOINT = 768;
const CREATE_LAYOUT_HEIGHT = "h-[calc(100vh-var(--header-height))]";
const CREATE_SIDEBAR_WIDTH = 220;

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
  const { user, loading, hasPermission } = useAuth();
  const { setHeaderStyle, resetHeaderStyle } = useHeaderStyle();
  const { isMobile } = useBreakpoint(MOBILE_BREAKPOINT);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const selectedMenuKeys = useMemo(() => [getSelectedKey(pathname)], [pathname]);
  const desktopSidebarWidth = sidebarCollapsed
    ? ADMIN_SIDEBAR_COLLAPSED_WIDTH
    : CREATE_SIDEBAR_WIDTH;

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
    if (!loading && user && !hasPermission(CONTENT_VIEW)) {
      message.warning('您没有权限访问内容创作中台');
      router.push('/');
    }
  }, [loading, user, hasPermission, router]);

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
        <AdminSidebar
          title="内容创作"
          mobileTitle="内容创作中台"
          mobileSubtitle="/create"
          mobileMenuAriaLabel="打开内容创作菜单"
          drawerTitle="内容创作中台"
          items={menuItems}
          selectedKeys={selectedMenuKeys}
          onMenuClick={handleMenuClick}
          isMobile={isMobile}
          drawerOpen={drawerOpen}
          onDrawerOpenChange={setDrawerOpen}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          width={280}
        />

        <Content className="flex-1 overflow-hidden bg-slate-50 px-3 py-4">
          {children}
        </Content>
      </Layout>
    );
  }

  return (
    <Layout className={`admin-light-shell ${CREATE_LAYOUT_HEIGHT} bg-slate-50 text-slate-950`}>
      <AdminSidebar
        title="内容创作"
        shortTitle="创作"
        badge="create"
        icon={<FormOutlined />}
        items={menuItems}
        selectedKeys={selectedMenuKeys}
        onMenuClick={handleMenuClick}
        isMobile={isMobile}
        drawerOpen={drawerOpen}
        onDrawerOpenChange={setDrawerOpen}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        width={CREATE_SIDEBAR_WIDTH}
      />
      <Layout
        className="h-full min-w-0 bg-slate-50 transition-[margin-left] duration-200"
        style={{ marginLeft: desktopSidebarWidth }}
      >
        <Content className="h-full overflow-hidden bg-slate-50 px-6 py-8">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
