/**
 * 管理后台布局
 * 包含左侧菜单和右侧内容区域
 * 移动端(<768px): Sider 隐藏，Drawer 抽屉替代
 * 桌面端(≥768px): 保持固定 Sider 布局
 */

"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Layout, Menu, message, Drawer } from "antd";
import type { MenuProps } from "antd";
import {
  FileTextOutlined,
  SettingOutlined,
  UserOutlined,
  BookOutlined,
  ClusterOutlined,
  SearchOutlined,
  MessageOutlined,
  SoundOutlined,
  PictureOutlined,
  MenuOutlined,
  SafetyOutlined,
  KeyOutlined,
  ApiOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useHeaderStyle } from "@/contexts/HeaderStyleContext";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import {
  COMMENT_MANAGE,
  COLLECTION_VIEW,
  QUEUE_VIEW,
  VECTOR_VIEW,
  TTS_VIEW,
  IMAGE_VIEW,
  CONFIG_VIEW,
  USER_VIEW,
  USER_MANAGE,
} from "@/constants/permissions";

const { Sider, Content } = Layout;

const MOBILE_BREAKPOINT = 768;

/**
 * 管理后台布局组件
 */
export default function CLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, hasPermission } = useAuth();
  const { setHeaderStyle, resetHeaderStyle } = useHeaderStyle();
  const { isMobile } = useBreakpoint(MOBILE_BREAKPOINT);
  const [drawerOpen, setDrawerOpen] = useState(false);

  /**
   * 动态生成菜单项
   * 根据权限码动态显示菜单
   */
  const menuItems: MenuProps["items"] = useMemo(() => {
    const items: MenuProps["items"] = [
      {
        key: "/c/post",
        icon: <FileTextOutlined />,
        label: "文章管理",
      },
    ];

    // 根据权限码动态添加菜单
    if (hasPermission(COMMENT_MANAGE)) {
      items.push({
        key: "/c/comments",
        icon: <MessageOutlined />,
        label: "评论管理",
      });
    }

    if (hasPermission(COLLECTION_VIEW)) {
      items.push({
        key: "/c/collections",
        icon: <BookOutlined />,
        label: "合集管理",
      });
    }

    if (hasPermission(QUEUE_VIEW)) {
      items.push({
        key: "/c/queue",
        icon: <ClusterOutlined />,
        label: "队列监控",
      });
    }

    if (hasPermission(VECTOR_VIEW)) {
      items.push({
        key: "/c/vector-search",
        icon: <SearchOutlined />,
        label: "向量检索",
      });
    }

    if (hasPermission(TTS_VIEW)) {
      items.push({
        key: "/c/tts",
        icon: <SoundOutlined />,
        label: "语音合成",
      });
    }

    if (hasPermission(IMAGE_VIEW)) {
      items.push({
        key: "/c/image-gen",
        icon: <PictureOutlined />,
        label: "AI 图片生成",
      });
    }

    if (hasPermission(CONFIG_VIEW)) {
      items.push({
        key: "/c/config",
        icon: <SettingOutlined />,
        label: "配置管理",
      });
    }

    if (hasPermission(USER_VIEW)) {
      items.push({
        key: "/c/user",
        icon: <UserOutlined />,
        label: "用户管理",
      });
    }

    if (hasPermission(USER_MANAGE)) {
      items.push({
        key: "/c/roles",
        icon: <SafetyOutlined />,
        label: "角色管理",
      });
      items.push({
        key: "/c/api-registry",
        icon: <ApiOutlined />,
        label: "接口管理",
      });
    }

    if (hasPermission(USER_VIEW)) {
      items.push({
        key: "/c/permissions",
        icon: <KeyOutlined />,
        label: "权限管理",
      });
    }

    return items;
  }, [hasPermission]);

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
   * 防止用户直接访问无权限的页面
   */
  useEffect(() => {
    if (!loading && user) {
      // 定义路径对应的权限码
      const pathPermissions: Record<string, string> = {
        '/c/comments': COMMENT_MANAGE,
        '/c/collections': COLLECTION_VIEW,
        '/c/config': CONFIG_VIEW,
        '/c/user': USER_VIEW,
        '/c/roles': USER_MANAGE,
        '/c/api-registry': USER_MANAGE,
        '/c/permissions': USER_VIEW,
        '/c/queue': QUEUE_VIEW,
        '/c/vector-search': VECTOR_VIEW,
        '/c/tts': TTS_VIEW,
        '/c/image-gen': IMAGE_VIEW,
      };

      // 个人中心页面例外处理
      const isPersonalCenter = pathname.startsWith('/c/user/info');

      if (!isPersonalCenter) {
        // 检查路径权限
        for (const [path, permission] of Object.entries(pathPermissions)) {
          if (pathname === path || pathname.startsWith(path + '/')) {
            if (!hasPermission(permission)) {
              message.warning('您没有权限访问此页面');
              router.push('/c/post');
              return;
            }
          }
        }
      }
    }
  }, [user, loading, pathname, router, hasPermission]);

  /**
   * 预加载所有管理路由
   * 提前加载路由代码和组件，实现接近 SPA 的切换体验
   */
  useEffect(() => {
    // 定义所有需要预加载的管理路由
    const routes = [
      '/c/post',
      '/c/comments',
      '/c/collections',
      '/c/config',
      '/c/user',
      '/c/user/info',
      '/c/roles',
      '/c/api-registry',
      '/c/permissions',
      '/c/queue',
      '/c/vector-search',
      '/c/tts',
      '/c/image-gen',
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
      (window as Window & { requestIdleCallback: (callback: () => void) => void }).requestIdleCallback(() => {
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
  const handleMenuClick: NonNullable<MenuProps["onClick"]> = useCallback((e) => {
    router.push(e.key);
    // 移动端点击菜单后自动关闭抽屉
    if (isMobile) {
      setDrawerOpen(false);
    }
  }, [router, isMobile]);

  // 如果正在加载或未登录，显示加载状态
  if (loading || !user) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] items-center justify-center">
        <div>加载中...</div>
      </div>
    );
  }

  // 移动端：隐藏 Sider，使用 Drawer + 全宽内容区
  if (isMobile) {
    return (
      <Layout className="h-[calc(100vh-var(--header-height))]">
        {/* 移动端顶部菜单切换按钮 */}
        <div
          className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0"
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center justify-center w-9 h-9 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="打开菜单"
          >
            <MenuOutlined className="text-lg" />
          </button>
          <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
            管理后台
          </span>
        </div>

        {/* 主内容区占满全宽 */}
        <Content className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900 px-3 py-4">
          {children}
        </Content>

        {/* 移动端抽屉菜单 */}
        <Drawer
          title="管理后台"
          placement="left"
          onClose={() => setDrawerOpen(false)}
          open={drawerOpen}
          width={260}
          styles={{
            body: { padding: 0 },
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={[pathname]}
            items={menuItems}
            onClick={handleMenuClick}
            className="border-r-0"
          />
        </Drawer>
      </Layout>
    );
  }

  // 桌面端：保持原有布局不变
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
