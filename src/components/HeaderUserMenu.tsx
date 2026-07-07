"use client";

import React, { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Avatar, Dropdown, Space } from "antd";
import type { MenuProps } from "antd";
import { EditOutlined, SettingOutlined, UserOutlined, LogoutOutlined, LoginOutlined } from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { USER_MANAGE } from "@/constants/permissions";

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * 头部导航中的用户信息和菜单区域
 * 基于设计稿重构
 */
export default function HeaderUserMenu() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout, hasPermission } = useAuth();

  // 防止 hydration mismatch：登录态由客户端异步获取，
  // SSR 时 user 恒为 null。在 mount 完成前渲染稳定占位，
  // 保证服务端与客户端首屏 DOM 一致。
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );

  // 构建当前完整 URL 用于登录后返回
  const currentUrl = useMemo(() => {
    const search = searchParams.toString();
    return search ? `${pathname}?${search}` : pathname;
  }, [pathname, searchParams]);

  const menuItems: MenuProps["items"] = [
    {
      key: "admin",
      label: <Link href="/c">管理后台</Link>,
      icon: <SettingOutlined />,
    },
    {
      key: "create",
      label: (
        <Link href="/create" target="_blank" rel="noopener noreferrer">
          内容创作中台
        </Link>
      ),
      icon: <EditOutlined />,
    },
    {
      key: "user",
      label: <Link href="/c/user/info">个人资料</Link>,
      icon: <UserOutlined />,
    },
    ...(hasPermission(USER_MANAGE)
      ? [
          {
            key: "settings",
            label: <Link href="/c/user">设置</Link>,
            icon: <SettingOutlined />,
          },
        ]
      : []),
    {
      type: "divider",
    },
    {
      key: "logout",
      label: "退出登录",
      icon: <LogoutOutlined className="text-red-600 dark:text-red-400" />,
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
      {!mounted ? (
        // 占位：宽度与登录按钮/头像区接近，避免首屏跳动；与服务端输出一致
        <span className="block h-8 w-24" aria-hidden />
      ) : user ? (
        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          <Space className="cursor-pointer">
            <Avatar size={32} icon={<UserOutlined />} src={user.avatar} />
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
          <LoginOutlined className="text-sm" />
        </Link>
      )}
    </div>
  );
}
