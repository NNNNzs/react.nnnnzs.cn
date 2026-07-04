"use client";

import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Empty, Tag } from "antd";
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  PictureOutlined,
  ProfileOutlined,
  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
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

type LabArea = {
  title: string;
  path: string;
  description: string;
  metric: string;
  status: "已接入" | "规划中";
  accent: string;
  permissions: string[];
  icon: ReactNode;
};

const LAB_AREAS: LabArea[] = [
  {
    title: "Run 观测",
    path: "/c/ai-lab/runs",
    description: "复用聊天记录、ReAct 思考链和工具耗时，作为 Run 索引的过渡入口。",
    metric: "来源: /c/chat-logs",
    status: "已接入",
    accent: "border-cyan-500",
    permissions: [CHAT_LOG_VIEW],
    icon: <RobotOutlined />,
  },
  {
    title: "检索实验台",
    path: "/c/ai-lab/retrieval-playground",
    description: "把原向量检索测试台移动到 AI Lab，后续扩展 topK、metadata、hybrid 对比。",
    metric: "来源: /c/vector-search",
    status: "已接入",
    accent: "border-emerald-500",
    permissions: [VECTOR_VIEW],
    icon: <SearchOutlined />,
  },
  {
    title: "AI 配置组",
    path: "/c/ai-lab/config",
    description: "集中管理 chat、embedding、image_gen、tts 等 AI Profile 场景配置。",
    metric: "来源: /c/config",
    status: "已接入",
    accent: "border-amber-500",
    permissions: [CONFIG_VIEW],
    icon: <SettingOutlined />,
  },
  {
    title: "图片生成",
    path: "/c/ai-lab/image-gen",
    description: "保留异步图片生成与历史记录，后续纳入多模态实验资产。",
    metric: "来源: /c/image-gen",
    status: "已接入",
    accent: "border-rose-500",
    permissions: [IMAGE_VIEW],
    icon: <PictureOutlined />,
  },
  {
    title: "语音合成",
    path: "/c/ai-lab/tts",
    description: "作为 TTS 模型、音色和生成质量对比的实验入口。",
    metric: "来源: /c/tts",
    status: "已接入",
    accent: "border-indigo-500",
    permissions: [TTS_VIEW],
    icon: <SoundOutlined />,
  },
  {
    title: "Eval Cases",
    path: "/c/ai-lab/eval-cases",
    description: "Golden Dataset 的用例维护入口，下一步接入真实数据表和导入链路。",
    metric: "目标: 30 条首批用例",
    status: "规划中",
    accent: "border-slate-400",
    permissions: [CHAT_LOG_VIEW, VECTOR_VIEW],
    icon: <FileSearchOutlined />,
  },
  {
    title: "Eval Runs",
    path: "/c/ai-lab/eval-runs",
    description: "批量评测运行与 Hit@K、MRR、Recall、latency 趋势入口。",
    metric: "目标: 基础 RAG 指标",
    status: "规划中",
    accent: "border-slate-400",
    permissions: [CHAT_LOG_VIEW, VECTOR_VIEW],
    icon: <ExperimentOutlined />,
  },
  {
    title: "Prompts",
    path: "/c/ai-lab/prompts",
    description: "Prompt 版本、diff、replay 和回滚证据入口。",
    metric: "目标: Prompt 快照",
    status: "规划中",
    accent: "border-slate-400",
    permissions: [CONFIG_VIEW],
    icon: <ProfileOutlined />,
  },
];

const ADMIN_SPLIT = [
  {
    title: "保留在主后台",
    items: ["文章管理", "评论管理", "合集管理", "队列监控", "单项配置", "模型检查台", "用户/角色/权限", "接口管理"],
  },
  {
    title: "拆入 AI Lab",
    items: ["聊天记录 -> Runs", "向量检索 -> 检索实验台", "AI 配置组", "AI 图片生成", "语音合成"],
  },
];

export default function AiLabPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();

  const visibleAreas = useMemo(
    () =>
      LAB_AREAS.filter((area) =>
        area.permissions.some((permission) => hasPermission(permission)),
      ),
    [hasPermission],
  );

  if (visibleAreas.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Empty description="暂无可访问的 AI Lab 模块" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-cyan-200 bg-cyan-50 p-4">
          <div className="text-sm text-cyan-700">已接入入口</div>
          <div className="mt-2 text-3xl font-semibold text-cyan-950">
            {visibleAreas.filter((area) => area.status === "已接入").length}
          </div>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm text-amber-700">规划模块</div>
          <div className="mt-2 text-3xl font-semibold text-amber-950">
            {visibleAreas.filter((area) => area.status === "规划中").length}
          </div>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-sm text-emerald-700">当前阶段</div>
          <div className="mt-2 text-xl font-semibold text-emerald-950">
            信息架构拆分
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleAreas.map((area) => (
            <div
              key={area.path}
              className={`flex min-h-[190px] flex-col rounded-md border bg-white p-4 shadow-sm ${area.accent}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg text-slate-700">{area.icon}</span>
                  <h2 className="m-0 text-base font-semibold text-slate-950">
                    {area.title}
                  </h2>
                </div>
                <Tag
                  color={area.status === "已接入" ? "success" : "default"}
                  icon={area.status === "已接入" ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                  className="mr-0"
                >
                  {area.status}
                </Tag>
              </div>
              <p className="mt-3 mb-3 flex-1 text-sm leading-6 text-slate-600">
                {area.description}
              </p>
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500">{area.metric}</span>
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowRightOutlined />}
                  aria-label={`进入${area.title}`}
                  onClick={() => router.push(area.path)}
                />
              </div>
            </div>
          ))}
        </div>

        <aside className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="m-0 text-base font-semibold text-slate-950">
            后台拆分边界
          </h2>
          <div className="mt-4 flex flex-col gap-4">
            {ADMIN_SPLIT.map((group) => (
              <div key={group.title}>
                <div className="mb-2 text-sm font-medium text-slate-700">
                  {group.title}
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
