/**
 * 管理后台布局
 * 包含左侧菜单和右侧内容区域
 */

"use client";

import React, { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Layout, Menu, message } from "antd";
import type { MenuProps } from "antd";
import { FileTextOutlined, SettingOutlined, UserOutlined, BookOutlined, ClusterOutlined, SearchOutlined } from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useHeaderStyle } from "@/contexts/HeaderStyleContext";
import { isAdmin } from "@/types/role";

const { Sider, Content } = Layout;

/**
 * 管理后台布局组件
 */
export default function CLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { setHeaderStyle, resetHeaderStyle } = useHeaderStyle();

  /**
   * 动态生成菜单项
   * 普通用户只显示"文章管理"，管理员显示所有菜单
   */
  const menuItems: MenuProps["items"] = useMemo(() => {
    const items: MenuProps["items"] = [
      {
        key: "/c/post",
        icon: <FileTextOutlined />,
        label: "文章管理",
      },
    ];

    // 管理员专属菜单
    if (isAdmin(user?.role)) {
      items.push(
        {
          key: "/c/collections",
          icon: <BookOutlined />,
          label: "合集管理",
        },
        {
          key: "/c/queue",
          icon: <ClusterOutlined />,
          label: "队列监控",
        },
        {
          key: "/c/vector-search",
          icon: <SearchOutlined />,
          label: "向量检索",
        },
        {
          key: "/c/config",
          icon: <SettingOutlined />,
          label: "配置管理",
        },
        {
          key: "/c/user",
          icon: <UserOutlined />,
          label: "用户管理",
        }
      );
    }

    return items;
  }, [user?.role]);

  /**
   * 检查登录状态
   * 只有在 loading 完成后才检查，避免误判
   */
  useEffect(() => {
    if (!loading && !user) {
      message.warning("请先登录");
      router.push("/login");
    }
  }, [user, loading, router]);

  /**
   * 路径访问权限检查
   * 防止普通用户直接访问管理员专属页面
   */
  useEffect(() => {
    if (!loading && user) {
      // 定义管理员专属路径
      // 注意：/c/user/info 是个人中心，所有用户都可以访问，所以只拦截 /c/user
      const adminOnlyPaths = ['/c/collections', '/c/config', '/c/user', '/c/queue', '/c/vector-search'];
      const isAdminPath = adminOnlyPaths.some(path => pathname === path || pathname.startsWith(path + '/'));

      // 个人中心页面例外处理
      const isPersonalCenter = pathname.startsWith('/c/user/info');

      if (isAdminPath && !isPersonalCenter && !isAdmin(user.role)) {
        message.warning('您没有权限访问此页面');
        router.push('/c/post');
      }
    }
  }, [user, loading, pathname, router]);

  /**
   * 预加载所有管理路由
   * 提前加载路由代码和组件，实现接近 SPA 的切换体验
   */
  useEffect(() => {
    // 定义所有需要预加载的管理路由
    const routes = [
      '/c/post',
      '/c/collections',
      '/c/config',
      '/c/user',
      '/c/user/info',
      '/c/queue',
      '/c/vector-search',
      '/c/edit/new',
    ];

    // 在用户空闲时预加载路由
    const prefetchRoutes = async () => {
      for (const route of routes) {
        try {
          await router.prefetch(route);
        } catch (error) {
          console.warn(`Failed to prefetch route: ${route}`, error);
        }
      }
    };

    // 使用 requestIdleCallback 在浏览器空闲时预加载
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        prefetchRoutes();
      });
    } else {
      // 降级方案：延迟 1 秒后预加载
      const timer = setTimeout(() => {
        prefetchRoutes();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [router]);

  /**
   * 后台页面统一控制 Header 样式：
   * - 不使用 fixed，避免遮挡后台布局
   * - 始终不透明，保证后台页面观感一致
   */
  useEffect(() => {
    setHeaderStyle({
      static: true,
      alwaysVisible: true,
    });

    return () => {
      resetHeaderStyle();
    };
  }, [setHeaderStyle, resetHeaderStyle]);

  /**
   * 处理菜单点击
   */
  const handleMenuClick: MenuProps["onClick"] = (e) => {
    router.push(e.key);
  };

  // 如果正在加载或未登录，显示加载状态
  if (loading || !user) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] items-center justify-center">
        <div>加载中...</div>
      </div>
    );
  }

  return (
    <Layout className="h-[calc(100vh-var(--header-height))]">
      <Sider
        width={200}
        className="bg-white "
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
        <div className="h-16 flex items-center justify-center border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            管理后台
          </h2>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          className="h-[calc(100vh-var(--header-height)-64px)] border-r-0"
        />
      </Sider>
      <Layout className="ml-[200px] h-full">
        <Content className="h-full overflow-hidden bg-slate-50 dark:bg-slate-900 container mx-auto px-4 py-8">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
