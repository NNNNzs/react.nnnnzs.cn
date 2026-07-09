"use client";

import { useCallback } from "react";
import { useAgentStream } from "@/hooks/useAgentStream";
import type { AgentMessage } from "@/types/agent-stream";
import type { UseAgentStreamSendOptions } from "@/hooks/useAgentStream";

export interface UseAssistantAgentOptions<TPatch = unknown> {
  endpoint: string;
  headers?: Record<string, string>;
  onPatch?: (patch: TPatch) => void;
  buildSendOptions?: (text: string) => UseAgentStreamSendOptions | undefined;
}

export interface UseAssistantAgentResult {
  messages: AgentMessage[];
  isStreaming: boolean;
  sendMessage: (text: string, history: AgentMessage[]) => Promise<void>;
  abort: () => void;
  reset: () => void;
  replaceMessages: (messages: AgentMessage[]) => void;
}

/**
 * 业务助手对话 Hook。
 *
 * useAgentStream 负责解析 SSE 标准事件；这里负责把具体业务场景收敛为
 * endpoint、headers、send options 和 typed patch，便于草稿、选题等入口复用。
 */
export function useAssistantAgent<TPatch = unknown>({
  endpoint,
  headers,
  onPatch,
  buildSendOptions,
}: UseAssistantAgentOptions<TPatch>): UseAssistantAgentResult {
  const { messages, isStreaming, sendMessage, abort, reset, replaceMessages } =
    useAgentStream<TPatch>({
      endpoint,
      headers,
      onPatch,
    });

  const send = useCallback(
    async (text: string, history: AgentMessage[]) => {
      await sendMessage(text, history, buildSendOptions?.(text));
    },
    [buildSendOptions, sendMessage],
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
