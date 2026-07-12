"use client";

import { useAssistantAgent } from "@/hooks/useAssistantAgent";
import type { AgentMessage } from "@/types/agent-stream";
import type { CreateAgentPageContext } from "@/types/create-agent";
import type { DraftPatch } from "@/services/ai/tools/create-tools/draft-patch";

export type { AgentMessage };

interface UseCreateAgentOptions {
  draftId: number;
  /** 每次发送消息时读取编辑器当前值，保证未保存内容可进入 Agent 上下文。 */
  getPageContext: () => CreateAgentPageContext;
  /** 收到 emit_draft_patch 触发的 patch 事件时进入待确认流程 */
  onPatch?: (patch: DraftPatch) => void;
}

/**
 * 内容中台创作助手对话 Hook
 *
 * 基于通用 useAgentStream 封装，添加：
 * - 自动注入 draftId 到 endpoint
 * - typed DraftPatch 回调
 * - 自动创建 user/assistant 消息对
 */
export function useCreateAgent({ draftId, getPageContext, onPatch }: UseCreateAgentOptions) {
  return useAssistantAgent<DraftPatch>({
    endpoint: `/api/create/drafts/${draftId}/chat`,
    onPatch,
    buildSendOptions: () => ({
      body: { pageContext: getPageContext() },
    }),
  });
}
