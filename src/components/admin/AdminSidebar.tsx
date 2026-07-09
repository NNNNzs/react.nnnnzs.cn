"use client";

import React from "react";
import { Drawer, Layout, Menu } from "antd";
import type { MenuProps } from "antd";
import {
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";

const { Sider } = Layout;

export const ADMIN_SIDEBAR_COLLAPSED_WIDTH = 72;

function joinClassNames(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

interface AdminSidebarProps {
  title: React.ReactNode;
  shortTitle?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  mobileTitle?: React.ReactNode;
  mobileSubtitle?: React.ReactNode;
  mobileMenuAriaLabel?: string;
  drawerTitle?: React.ReactNode;
  items: MenuProps["items"];
  selectedKeys: string[];
  onMenuClick: NonNullable<MenuProps["onClick"]>;
  isMobile: boolean;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  width: number;
  collapsedWidth?: number;
}

export default function AdminSidebar({
  title,
  shortTitle,
  badge,
  icon,
  mobileTitle,
  mobileSubtitle,
  mobileMenuAriaLabel = "打开菜单",
  drawerTitle,
  items,
  selectedKeys,
  onMenuClick,
  isMobile,
  drawerOpen,
  onDrawerOpenChange,
  collapsed,
  onCollapsedChange,
  width,
  collapsedWidth = ADMIN_SIDEBAR_COLLAPSED_WIDTH,
}: AdminSidebarProps) {
  if (isMobile) {
    return (
      <>
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
          <button
            type="button"
            onClick={() => onDrawerOpenChange(true)}
            className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-slate-100"
            aria-label={mobileMenuAriaLabel}
          >
            <MenuOutlined className="text-lg" />
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-800">
              {mobileTitle ?? title}
            </div>
            {mobileSubtitle ? (
              <div className="truncate text-xs text-slate-500">
                {mobileSubtitle}
              </div>
            ) : null}
          </div>
        </div>

        <Drawer
          title={drawerTitle ?? title}
          placement="left"
          onClose={() => onDrawerOpenChange(false)}
          open={drawerOpen}
          size={width}
          rootClassName="admin-light-drawer"
          styles={{
            body: { padding: 0 },
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={selectedKeys}
            items={items}
            onClick={onMenuClick}
            className="border-r-0"
          />
        </Drawer>
      </>
    );
  }

  return (
    <Sider
      width={width}
      collapsedWidth={collapsedWidth}
      collapsed={collapsed}
      trigger={null}
      className="admin-light-sider bg-white"
      theme="light"
      style={{
        overflow: "hidden",
        height: "calc(100vh - var(--header-height))",
        position: "fixed",
        left: 0,
        top: "var(--header-height)",
        bottom: 0,
      }}
    >
      <div
        className={joinClassNames(
          "flex h-16 items-center border-b border-slate-200 px-3",
          collapsed ? "justify-center" : "justify-between gap-2",
        )}
      >
        {collapsed ? null : (
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2 text-base font-semibold text-slate-900">
              {icon}
              <span className="truncate">{title}</span>
            </div>
            {badge ? (
              <div className="mt-1 inline-flex max-w-full items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] leading-4 text-slate-500">
                <span className="truncate">{badge}</span>
              </div>
            ) : null}
          </div>
        )}
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          aria-label={collapsed ? "展开菜单" : "收起菜单"}
          title={collapsed ? "展开菜单" : "收起菜单"}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>
      </div>

      <Menu
        mode="inline"
        inlineCollapsed={collapsed}
        selectedKeys={selectedKeys}
        items={items}
        onClick={onMenuClick}
        className="admin-light-menu border-r-0"
        style={{
          height: "calc(100vh - var(--header-height) - 64px)",
          overflowY: "auto",
        }}
        title={collapsed ? String(shortTitle ?? title) : undefined}
      />
    </Sider>
  );
}
