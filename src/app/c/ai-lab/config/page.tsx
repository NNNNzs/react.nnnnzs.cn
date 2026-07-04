"use client";

import { SettingOutlined } from "@ant-design/icons";
import { Tag } from "antd";
import AIProfilePanel from "../../config/AIProfilePanel";

export default function AiLabConfigPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-2">
        <SettingOutlined className="text-xl text-cyan-700" />
        <h2 className="m-0 text-xl font-semibold text-slate-950">
          AI 配置组
        </h2>
        <Tag color="cyan">Profiles</Tag>
      </div>
      <div className="min-h-0 flex-1">
        <AIProfilePanel />
      </div>
    </div>
  );
}
