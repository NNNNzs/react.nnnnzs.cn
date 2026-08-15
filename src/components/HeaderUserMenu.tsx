"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Avatar, Dropdown, message, Space } from "antd";
import type { MenuProps } from "antd";
import {
  EditOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  LoginOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { CDN_PURGE_VIEW, CONTENT_VIEW, USER_MANAGE } from "@/constants/permissions";
import NotificationBell from "@/components/NotificationBell";

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
  const [messageApi, messageContextHolder] = message.useMessage();
  const [purgingCurrentPage, setPurgingCurrentPage] = useState(false);

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

  const purgeCurrentPage = async () => {
    if (purgingCurrentPage) return;

    setPurgingCurrentPage(true);
    try {
      const response = await fetch("/api/admin/cdn/purge-current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentUrl }),
      });
      const result = await response.json() as { status?: boolean; message?: string };
      if (!response.ok || !result.status) {
        throw new Error(result.message || "刷新当前页面 CDN 失败");
      }
      messageApi.success(result.message || "当前页面 CDN 刷新已提交");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "刷新当前页面 CDN 失败");
    } finally {
      setPurgingCurrentPage(false);
    }
  };

  const menuItems: MenuProps["items"] = [
    {
      key: "admin",
      label: <Link href="/c">管理后台</Link>,
      icon: <SettingOutlined />,
    },
    ...(hasPermission(CONTENT_VIEW)
      ? [
          {
            key: "create",
            label: (
              <Link href="/create" target="_blank" rel="noopener noreferrer">
                内容创作中台
              </Link>
            ),
            icon: <EditOutlined />,
          },
        ]
      : []),
    {
      key: "user",
      label: <Link href="/c/user/info">个人设置</Link>,
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
    ...(hasPermission(CDN_PURGE_VIEW)
      ? [
          {
            key: "purge-current-page-cdn",
            label: purgingCurrentPage ? "正在刷新当前页面 CDN" : "刷新当前页面 CDN",
            icon: <ReloadOutlined />,
            disabled: purgingCurrentPage,
            onClick: () => void purgeCurrentPage(),
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
    <>
      {messageContextHolder}
      <div className="h-full flex items-center">
        {!mounted ? (
          // 占位：宽度与登录按钮/头像区接近，避免首屏跳动；与服务端输出一致
          <span className="block h-8 w-24" aria-hidden />
        ) : user ? (
          <Space size="small">
            <NotificationBell userId={user.id} />
            <Dropdown menu={{ items: menuItems }} placement="bottomRight">
              <Space className="cursor-pointer">
                <Avatar size={32} icon={<UserOutlined />} src={user.avatar} />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {user.nickname}
                </span>
              </Space>
            </Dropdown>
          </Space>
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
    </>
  );
}
