"use client";

import { AgentAssistantPanel } from "@/components/agent/AgentAssistantPanel";
import type { AgentMessage } from "./useTopicAgent";

interface TopicAgentPanelProps {
  open: boolean;
  onClose: () => void;
  messages: AgentMessage[];
  isStreaming: boolean;
  onSend: (text: string) => void;
  onAbort: () => void;
  hasPendingPatch: boolean;
  onViewPatch: () => void;
  editingTitle?: string;
}

const QUICK_PROMPTS = [
  { label: "把我的想法整理成一个选题，并检查是否重复" },
  { label: "读取这个链接，提炼核心角度和关键点" },
  { label: "保留原始想法，帮我把选题方向描述清楚" },
];

export function TopicAgentPanel({
  open,
  onClose,
  messages,
  isStreaming,
  onSend,
  onAbort,
  hasPendingPatch,
  onViewPatch,
  editingTitle,
}: TopicAgentPanelProps) {
  return (
    <AgentAssistantPanel
      open={open}
      onClose={onClose}
      title={editingTitle ? `AI 完善：${editingTitle}` : "AI 整理选题"}
      messages={messages}
      isStreaming={isStreaming}
      onSend={onSend}
      onAbort={onAbort}
      quickPrompts={QUICK_PROMPTS}
      emptyDescription="给我一句想法、博客文章 ID 或网页链接。我会先查重，再给出可确认的选题建议。"
      patchNotice={hasPendingPatch ? "收到选题建议，待确认" : "选题建议已处理"}
      patchActionLabel={hasPendingPatch ? "查看对比" : undefined}
      onPatchAction={hasPendingPatch ? onViewPatch : undefined}
      placeholder="输入想法、博客 ID 或来源链接..."
      width={460}
    />
  );
}
