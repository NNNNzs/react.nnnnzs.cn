"use client";

import { useCallback } from "react";
import { useAgentStream } from "@/hooks/useAgentStream";
import type { AgentMessage } from "@/types/agent-stream";
import type { DraftPatch } from "@/services/ai/tools/create-tools/draft-patch";

export type { AgentMessage };

interface UseCreateAgentOptions {
  draftId: number;
  /** 收到 draft_patch 时应用（setBody/setTitle/attach 图片） */
  onPatch?: (patch: DraftPatch) => void;
}

/**
 * 内容中台创作助手对话 Hook
 *
 * 基于通用 useAgentStream 封装，添加：
 * - 自动注入 draftId 到 endpoint
 * - draft_patch → patch 事件映射
 * - 自动创建 user/assistant 消息对
 */
export function useCreateAgent({ draftId, onPatch }: UseCreateAgentOptions) {
  const { messages, isStreaming, sendMessage, abort, reset, replaceMessages } =
    useAgentStream<DraftPatch>({
      endpoint: `/api/create/drafts/${draftId}/chat`,
      headers: {},
      onPatch: (patch) => {
        onPatch?.(patch as DraftPatch);
      },
    });

  const send = useCallback(
    async (text: string, history: AgentMessage[]) => {
      await sendMessage(text, history);
    },
    [sendMessage],
  );

  return {
    messages,
    isStreaming,
    sendMessage: send,
    abort,
    reset,
    replaceMessages,
  };
}
