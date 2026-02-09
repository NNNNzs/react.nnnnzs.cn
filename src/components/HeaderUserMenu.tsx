"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Avatar, Dropdown, Space } from "antd";
import type { MenuProps } from "antd";
import { useAuth } from "@/contexts/AuthContext";

/**
 * 头部导航中的用户信息和菜单区域
 * 基于设计稿重构
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
      icon: <span className="material-symbols-outlined">edit</span>,
    },
    {
      key: "user",
      label: <Link href="/c/user/info">个人资料</Link>,
      icon: <span className="material-symbols-outlined">person</span>,
    },
    {
      key: "settings",
      label: <Link href="/c/user">设置</Link>,
      icon: <span className="material-symbols-outlined">settings</span>,
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      label: "退出登录",
      icon: <span className="material-symbols-outlined text-red-600 dark:text-red-400">logout</span>,
      onClick: async () => {
        await logout();
        // 退出后返回当前页面
        window.location.href = currentUrl;
      },
      className: "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20",
    },
  ];

  return (
    <div className="h-full flex items-center">
      {user ? (
        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          <Space className="cursor-pointer">
            <Avatar size={32} icon={<span className="material-symbols-outlined">person</span>} src={user.avatar} />
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {user.nickname}
            </span>
          </Space>
        </Dropdown>
      ) : (
        <Link
          href={`/login?redirect=${encodeURIComponent(currentUrl)}`}
          className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <span>登录</span>
          <span className="material-symbols-outlined text-sm">login</span>
        </Link>
      )}
    </div>
  );
}
