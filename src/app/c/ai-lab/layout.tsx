"use client";

import React, { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Tag } from "antd";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  PictureOutlined,
  ProfileOutlined,
  RobotOutlined,
  SearchOutlined,
  SoundOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import {
  CHAT_LOG_VIEW,
  CONFIG_VIEW,
  IMAGE_VIEW,
  TTS_VIEW,
  VECTOR_VIEW,
} from "@/constants/permissions";

type AiLabNavItem = {
  path: string;
  label: string;
  permissions: string[];
  icon: React.ReactNode;
  phase?: string;
};

const AI_LAB_NAV_ITEMS: AiLabNavItem[] = [
  {
    path: "/c/ai-lab",
    label: "总览",
    permissions: [CHAT_LOG_VIEW, VECTOR_VIEW, IMAGE_VIEW, TTS_VIEW, CONFIG_VIEW],
    icon: <DashboardOutlined />,
  },
  {
    path: "/c/ai-lab/runs",
    label: "Runs",
    permissions: [CHAT_LOG_VIEW],
    icon: <RobotOutlined />,
  },
  {
    path: "/c/ai-lab/retrieval-playground",
    label: "检索实验台",
    permissions: [VECTOR_VIEW],
    icon: <SearchOutlined />,
  },
  {
    path: "/c/ai-lab/image-gen",
    label: "图片生成",
    permissions: [IMAGE_VIEW],
    icon: <PictureOutlined />,
  },
  {
    path: "/c/ai-lab/tts",
    label: "语音合成",
    permissions: [TTS_VIEW],
    icon: <SoundOutlined />,
  },
  {
    path: "/c/ai-lab/eval-cases",
    label: "Eval Cases",
    permissions: [CHAT_LOG_VIEW, VECTOR_VIEW],
    icon: <FileSearchOutlined />,
    phase: "规划",
  },
  {
    path: "/c/ai-lab/eval-runs",
    label: "Eval Runs",
    permissions: [CHAT_LOG_VIEW, VECTOR_VIEW],
    icon: <ExperimentOutlined />,
    phase: "规划",
  },
  {
    path: "/c/ai-lab/prompts",
    label: "Prompts",
    permissions: [CONFIG_VIEW],
    icon: <ProfileOutlined />,
  },
];

function getActivePath(pathname: string) {
  const matched = [...AI_LAB_NAV_ITEMS]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));

  return matched?.path ?? "/c/ai-lab";
}

export default function AiLabLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasPermission } = useAuth();

  const canAccess = useCallback(
    (permissions: string[]) => permissions.some((permission) => hasPermission(permission)),
    [hasPermission],
  );

  const visibleItems = useMemo(
    () => AI_LAB_NAV_ITEMS.filter((item) => canAccess(item.permissions)),
    [canAccess],
  );

  const menuItems: MenuProps["items"] = useMemo(
    () =>
      visibleItems.map((item) => ({
        key: item.path,
        icon: item.icon,
        label: (
          <span className="inline-flex items-center gap-2">
            {item.label}
            {item.phase && <Tag color="default" className="mr-0">{item.phase}</Tag>}
          </span>
        ),
      })),
    [visibleItems],
  );

  const handleMenuClick: NonNullable<MenuProps["onClick"]> = useCallback(
    (event) => {
      router.push(event.key);
    },
    [router],
  );

  return (
    <div className="flex h-full min-h-0 flex-col text-slate-950">
      <div className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ExperimentOutlined className="text-xl text-cyan-700" />
              <h1 className="m-0 text-xl font-semibold tracking-normal text-slate-950">
                AI Lab
              </h1>
              <Tag color="cyan">LLMOps</Tag>
            </div>
            <p className="mt-1 mb-0 text-sm text-slate-500">
              Run 观测、RAG 检索实验、模型配置和评测闭环的独立后台空间
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-cyan-800">
              已拆入 {visibleItems.filter((item) => !item.phase).length} 个入口
            </span>
            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
              规划 {visibleItems.filter((item) => item.phase).length} 个实验模块
            </span>
          </div>
        </div>
        <div className="overflow-x-auto px-2">
          <Menu
            mode="horizontal"
            selectedKeys={[getActivePath(pathname)]}
            items={menuItems}
            onClick={handleMenuClick}
            className="min-w-max border-b-0"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-5 lg:px-2">
        {children}
      </div>
    </div>
  );
}
