"use client";

import { useCallback, useRef, useState } from "react";
import { parseSSEStream, parseSSEData } from "@/lib/sse";
import type { DraftPatch } from "@/services/ai/tools/create-tools/draft-patch";

export interface AgentToolCall {
  step: number;
  tool: string;
  args?: unknown;
  result?: string;
  status: "running" | "done";
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools: AgentToolCall[];
  /** 标记收到过 draft_patch，便于 UI 提示用户保存 */
  hasPatch?: boolean;
}

interface UseCreateAgentOptions {
  draftId: number;
  /** 收到 draft_patch 时应用（setBody/setTitle/attach 图片） */
  onPatch?: (patch: DraftPatch) => void;
}

let messageSeq = 0;
function nextId() {
  messageSeq += 1;
  return `m-${Date.now()}-${messageSeq}`;
}

export function useCreateAgent({ draftId, onPatch }: UseCreateAgentOptions) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // 同步锁：isStreaming 是异步 state，连点发送时闭包里仍是旧值，用 ref 兜底
  const sendingRef = useRef(false);

  const sendMessage = useCallback(
    async (text: string, history: AgentMessage[]) => {
      if (!text.trim() || sendingRef.current) return;
      sendingRef.current = true;

      const userMsg: AgentMessage = { id: nextId(), role: "user", content: text, tools: [] };
      const assistantMsg: AgentMessage = { id: nextId(), role: "assistant", content: "", tools: [] };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`/api/create/drafts/${draftId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: history
              .filter((m) => m.content || m.tools.length)
              .slice(-10)
              .map((m) => ({ role: m.role, content: m.content })),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "请求失败");
          throw new Error(errText);
        }

        await parseSSEStream(
          response,
          (frame) => {
            const data = parseSSEData(frame.data);
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== assistantMsg.id) return msg;
                switch (frame.event) {
                  case "token": {
                    const token = (data as { content?: string })?.content ?? "";
                    return { ...msg, content: msg.content + token };
                  }
                  case "tool_start": {
                    const { tool, args, step } = data as {
                      tool: string;
                      args?: unknown;
                      step: number;
                    };
                    return {
                      ...msg,
                      tools: [...msg.tools, { step, tool, args, status: "running" }],
                    };
                  }
                  case "tool_end": {
                    const { result, step } = data as {
                      result?: string;
                      step: number;
                    };
                    return {
                      ...msg,
                      tools: msg.tools.map((t) =>
                        t.step === step && t.status === "running"
                          ? { ...t, result, status: "done" }
                          : t,
                      ),
                    };
                  }
                  case "draft_patch": {
                    onPatch?.(data as DraftPatch);
                    return { ...msg, hasPatch: true };
                  }
                  default:
                    return msg;
                }
              }),
            );
          },
          controller.signal,
        );
      } catch (error) {
        if (controller.signal.aborted) {
          // 用户主动停止，静默
        } else {
          const errMsg = error instanceof Error ? error.message : "对话失败";
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsg.id
                ? { ...msg, content: msg.content || `❌ ${errMsg}` }
                : msg,
            ),
          );
        }
      } finally {
        sendingRef.current = false;
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [draftId, onPatch],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isStreaming, sendMessage, abort, reset };
}
