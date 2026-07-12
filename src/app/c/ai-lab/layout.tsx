"use client";

import React, { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
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

function joinClassNames(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

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

  const activePath = getActivePath(pathname);
  const isImageWorkbench = activePath === "/c/ai-lab/image-gen";

  const handleNavClick = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router],
  );

  return (
    <div className="flex h-full min-h-0 flex-col text-slate-950">
      <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2 lg:px-4">
        <div className="flex min-h-8 flex-col gap-2 lg:flex-row lg:items-center">
          <div className="flex shrink-0 items-center gap-2">
            <ExperimentOutlined className="text-base text-cyan-700" />
            <h1 className="m-0 text-base font-semibold tracking-normal text-slate-950">
              AI Lab
            </h1>
            <span className="rounded border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[11px] leading-4 text-cyan-800">
              LLMOps
            </span>
          </div>
          <div className="-mx-1 min-w-0 flex-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <nav
              aria-label="AI Lab 模块导航"
              className="flex min-w-max items-center gap-1"
            >
              {visibleItems.map((item) => {
                const isActive = activePath === item.path;

                return (
                  <button
                    key={item.path}
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => handleNavClick(item.path)}
                    className={joinClassNames(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors",
                      isActive
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                    )}
                  >
                    <span className="text-[13px] leading-none">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.phase ? (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] leading-4 text-slate-500">
                        {item.phase}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
      <div className={joinClassNames(
        "min-h-0 flex-1 px-1 lg:px-2",
        isImageWorkbench ? "overflow-hidden py-2" : "overflow-y-auto py-3",
      )}>
        {children}
      </div>
    </div>
  );
}
