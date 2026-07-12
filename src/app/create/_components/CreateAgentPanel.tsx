"use client";

import type { AgentMessage } from "./useCreateAgent";
import { AgentAssistantPanel } from "@/components/agent/AgentAssistantPanel";

interface CreateAgentPanelProps {
  open: boolean;
  onClose: () => void;
  messages: AgentMessage[];
  isStreaming: boolean;
  onSend: (text: string) => void;
  onAbort: () => void;
  hasPendingPatch?: boolean;
  onViewPatch?: () => void;
  platform?: string;
}

const XHS_QUICK_PROMPTS = [
  { label: "基于正文写 3 条小红书标题，填到 hook" },
  { label: "为第一张图卡生成配图" },
  { label: "把这篇草稿扩展成 3 张图卡的图文" },
];

const ZHIHU_QUICK_PROMPTS = [
  { label: "根据来源选题生成一版结构完整的 Markdown 长文" },
  { label: "检查当前文章论证结构并给出修改建议" },
  { label: "补充一个可运行的示例和踩坑说明" },
];

export function CreateAgentPanel({
  open,
  onClose,
  messages,
  isStreaming,
  onSend,
  onAbort,
  hasPendingPatch = false,
  onViewPatch,
  platform,
}: CreateAgentPanelProps) {
  const isZhihu = platform === "zhihu";
  return (
    <AgentAssistantPanel
      open={open}
      onClose={onClose}
      title="创作助手"
      messages={messages}
      isStreaming={isStreaming}
      onSend={onSend}
      onAbort={onAbort}
      quickPrompts={isZhihu ? ZHIHU_QUICK_PROMPTS : XHS_QUICK_PROMPTS}
      emptyDescription={isZhihu
        ? "可以让我根据来源选题起草、调整文章结构或完善 Markdown 长文。建议会先对比再应用。"
        : "告诉我你想做什么：改标题、写文案、生成配图。AI 给出草稿建议后，你可以先对比再应用。"}
      patchNotice={hasPendingPatch ? "收到草稿建议，待确认" : "草稿建议已处理"}
      patchActionLabel={hasPendingPatch ? "查看对比" : undefined}
      onPatchAction={hasPendingPatch ? onViewPatch : undefined}
      placeholder="对助手说点什么..."
    />
  );
}
