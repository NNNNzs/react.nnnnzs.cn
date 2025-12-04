/**
 * 管理后台布局
 * 包含左侧菜单和右侧内容区域
 */

'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Layout, Menu, message } from 'antd';
import type { MenuProps } from 'antd';
import {
  FileTextOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';

const { Sider, Content } = Layout;

/**
 * 菜单项配置
 */
const menuItems: MenuProps['items'] = [
  {
    key: '/c/post',
    icon: <FileTextOutlined />,
    label: '文章管理',
  },
  {
    key: '/c/config',
    icon: <SettingOutlined />,
    label: '配置管理',
  },
];

/**
 * 管理后台布局组件
 */
export default function CLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  /**
   * 检查登录状态
   * 只有在 loading 完成后才检查，避免误判
   */
  useEffect(() => {
    if (!loading && !user) {
      message.warning('请先登录');
      router.push('/login');
    }
  }, [user, loading, router]);

  /**
   * 处理菜单点击
   */
  const handleMenuClick: MenuProps['onClick'] = (e) => {
    router.push(e.key);
  };

  // 如果正在加载或未登录，显示加载状态
  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div>加载中...</div>
      </div>
    );
  }

  return (
    <Layout className="h-screen">
      <Sider
        width={200}
        className="bg-white dark:bg-slate-800"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
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
          className="h-[calc(100vh-64px)] border-r-0"
        />
      </Sider>
      <Layout className="ml-[200px]">
        <Content className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 container mx-auto px-4 py-8 pt-10">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
