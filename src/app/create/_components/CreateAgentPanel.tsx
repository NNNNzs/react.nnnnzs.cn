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
}

const QUICK_PROMPTS = [
  { label: "基于正文写 3 条小红书标题，填到 hook" },
  { label: "为第一张图卡生成配图" },
  { label: "把这篇草稿扩展成 3 张图卡的图文" },
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
}: CreateAgentPanelProps) {
  return (
    <AgentAssistantPanel
      open={open}
      onClose={onClose}
      title="创作助手"
      messages={messages}
      isStreaming={isStreaming}
      onSend={onSend}
      onAbort={onAbort}
      quickPrompts={QUICK_PROMPTS}
      emptyDescription="告诉我你想做什么：改标题、写文案、生成配图。AI 给出草稿建议后，你可以先对比再应用。"
      patchNotice={hasPendingPatch ? "收到草稿建议，待确认" : "草稿建议已处理"}
      patchActionLabel={hasPendingPatch ? "查看对比" : undefined}
      onPatchAction={hasPendingPatch ? onViewPatch : undefined}
      placeholder="对助手说点什么..."
    />
  );
}
