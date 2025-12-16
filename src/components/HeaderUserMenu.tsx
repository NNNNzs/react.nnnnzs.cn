"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Avatar, Dropdown, Space } from "antd";
import type { MenuProps } from "antd";
import { UserOutlined, LogoutOutlined, EditOutlined } from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";

/**
 * 头部导航中的用户信息和菜单区域
 * 单独拆分出来并使用 useSearchParams，以便在外层用 Suspense 包裹，
 * 最小化对 Header 其他内容的影响，保证主要导航可用于 SEO。
 */
export default function HeaderUserMenu() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();

  // 构建当前完整 URL 用于登录后返回
  const currentUrl = useMemo(() => {
    const search = searchParams.toString();
    return search ? `${pathname}?${search}` : pathname;
  }, [pathname, searchParams]);

  const menuItems: MenuProps["items"] = [
    {
      key: "admin",
      label: <Link href="/c">管理后台</Link>,
      icon: <EditOutlined />,
    },
    {
      key: "user",
      label: <Link href="/c/user/info">个人中心</Link>,
      icon: <UserOutlined />,
    },
    {
      key: "logout",
      label: "退出登录",
      icon: <LogoutOutlined />,
      onClick: async () => {
        await logout();
        // 退出后返回当前页面
        window.location.href = currentUrl;
      },
    },
  ];

  return (
    <div className="h-full flex items-center">
      {user ? (
        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          <Space className="cursor-pointer">
            <Avatar size={32} icon={<UserOutlined />} src={user.avatar} />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {user.nickname}
            </span>
          </Space>
        </Dropdown>
      ) : (
        <Link
          href={`/login?redirect=${encodeURIComponent(currentUrl)}`}
          className="text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300"
        >
          登录
        </Link>
      )}
    </div>
  );
}


