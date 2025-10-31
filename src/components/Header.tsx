/**
 * 头部导航组件
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, Dropdown, Space } from 'antd';
import type { MenuProps } from 'antd';
import { UserOutlined, LogoutOutlined, EditOutlined } from '@ant-design/icons';

export default function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const menuItems: MenuProps['items'] = [
    {
      key: 'admin',
      label: <Link href="/c">管理后台</Link>,
      icon: <EditOutlined />,
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      onClick: async () => {
        await logout();
        window.location.href = '/';
      },
    },
  ];

  const navItems = [
    { href: '/', label: '首页' },
    { href: '/tags', label: '标签' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/60 dark:bg-slate-900/95 dark:supports-backdrop-filter:bg-slate-900/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              我的博客
            </span>
          </Link>

          {/* 导航 */}
          <nav className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                  pathname === item.href
                    ? 'text-blue-600'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* 用户信息 */}
          <div className="flex items-center space-x-4">
            {user ? (
              <Dropdown menu={{ items: menuItems }} placement="bottomRight">
                <Space className="cursor-pointer">
                  <Avatar
                    size="default"
                    icon={<UserOutlined />}
                    src={user.avatar}
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {user.nickname}
                  </span>
                </Space>
              </Dropdown>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300"
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

