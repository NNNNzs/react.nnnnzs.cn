"use client";

import { useCallback, useRef, useState } from "react";
import { parseSSEStream, parseSSEData } from "@/lib/sse";
import type {
  AgentMessage,
  SSEClientEvent,
} from "@/types/agent-stream";

/**
 * useAgentStream 选项
 */
export interface UseAgentStreamOptions<TContext = unknown> {
  /** 对话端点完整 URL */
  endpoint: string;
  /** 额外请求头 */
  headers?: Record<string, string>;
  /** 收到 patch 事件时的回调（如 draft_patch） */
  onPatch?: (patch: TContext) => void;
  /** 原始 SSE 帧回调（用于自定义处理） */
  onFrame?: (frame: SSEClientEvent) => void;
}

/**
 * useAgentStream 返回值
 */
export interface UseAgentStreamResult {
  /** 消息列表 */
  messages: AgentMessage[];
  /** 是否正在流式输出 */
  isStreaming: boolean;
  /** 发送消息（history 只传 role + content 即可） */
  sendMessage: (text: string, history: Array<Pick<AgentMessage, 'role' | 'content'>>) => Promise<void>;
  /** 中断当前请求 */
  abort: () => void;
  /** 清空消息 */
  reset: () => void;
  /** 替换整个消息列表（用于加载历史会话） */
  replaceMessages: (msgs: AgentMessage[]) => void;
}

let messageSeq = 0;
function nextId(): string {
  messageSeq += 1;
  return `m-${Date.now()}-${messageSeq}`;
}

/**
 * 通用 SSE Agent 对话 Hook
 *
 * 封装标准 SSE 流式通信：
 * - 请求：POST JSON body `{ message, history, ...extra }`
 * - 响应：text/event-stream，事件集见 SSEClientEvent
 *
 * 适用于：
 * - /chat 知识问答（think/step/content 渲染 + ReAct Timeline）
 * - /create 创作助手（tool calls + draft_patch）
 */
export function useAgentStream<TContext = unknown>({
  endpoint,
  headers = {},
  onPatch,
  onFrame,
}: UseAgentStreamOptions<TContext>): UseAgentStreamResult {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);

  const sendMessage = useCallback(
    async (text: string, history: Array<Pick<AgentMessage, 'role' | 'content'>>) => {
      if (!text.trim() || sendingRef.current) return;
      sendingRef.current = true;

      // 创建用户消息和 AI 占位消息
      const userMsg: AgentMessage = {
        id: nextId(),
        role: "user",
        content: text,
        tools: [],
      };
      const assistantMsg: AgentMessage = {
        id: nextId(),
        role: "assistant",
        content: "",
        tools: [],
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // 构造请求体：message + history（只传前端需要的字段）+ 保留原始 extra
        const body: Record<string, unknown> = {
          message: text,
          history: history
            .filter((m) => m.content)
            .slice(-10)
            .map((m) => ({ role: m.role, content: m.content })),
        };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "请求失败");
          throw new Error(errText);
        }

        // 解析 SSE 流
        await parseSSEStream(
          response,
          (frame) => {
            const rawData = parseSSEData(frame.data);
            // 确保 data 是对象类型
            if (typeof rawData !== "object" || rawData === null) {
              return;
            }
            const data = rawData as Record<string, unknown>;

            // 触发原始帧回调
            const sseEvent = {
              event: frame.event as SSEClientEvent["event"],
              data: data as SSEClientEvent["data"],
            } as SSEClientEvent;
            onFrame?.(sseEvent);

            // 更新消息状态
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== assistantMsg.id) return msg;

                switch (frame.event) {
                  // --- 工具调用（融入 reactTimeline，保持 SSE 时间顺序） ---
                  case "tool_start": {
                    const { tool, args, step, startedAt } = data as {
                      tool: string;
                      args?: unknown;
                      step: number;
                      startedAt?: string;
                    };
                    const argsContent = typeof args === "string" ? args : JSON.stringify(args);
                    const reactTimeline = (msg.reactTimeline || []).map((item) =>
                      item.type === "think" ? { ...item, isStreaming: false } : item,
                    );
                    // 同一 step 复用已有 loop，否则新建
                    const existingIdx = reactTimeline.findIndex(
                      (item) => item.type === "loop" && item.index === step,
                    );
                    if (existingIdx >= 0) {
                      const target = reactTimeline[existingIdx];
                      if (target.type === "loop") {
                        reactTimeline[existingIdx] = {
                          ...target,
                          steps: [
                            ...target.steps,
                            {
                              type: "action",
                              content: argsContent || tool,
                              toolName: tool,
                              startedAt,
                              isStreaming: true,
                            },
                          ],
                        };
                      }
                    } else {
                      reactTimeline.push({
                        type: "loop",
                        index: step,
                        steps: [
                          {
                            type: "action",
                            content: argsContent || tool,
                            toolName: tool,
                            startedAt,
                            isStreaming: true,
                          },
                        ],
                      });
                    }
                    return {
                      ...msg,
                      reactTimeline,
                      tools: [
                        ...msg.tools,
                        { step, tool, args, status: "running" },
                      ],
                    };
                  }

                  case "tool_end": {
                    const { result, step, endedAt, durationMs } = data as {
                      result?: string;
                      step: number;
                      endedAt?: string;
                      durationMs?: number;
                    };
                    const reactTimeline = (msg.reactTimeline || []).map((item) => {
                      if (item.type !== "loop" || item.index !== step) return item;
                      // 把该 loop 最后一个 action 步骤转为 observation
                      const steps = [...item.steps];
                      for (let i = steps.length - 1; i >= 0; i--) {
                        if (steps[i].type === "action") {
                          steps[i] = {
                            ...steps[i],
                            type: "observation",
                            content: result || steps[i].toolName || "",
                            endedAt,
                            durationMs,
                            isStreaming: false,
                          };
                          break;
                        }
                      }
                      return { ...item, steps };
                    });
                    return {
                      ...msg,
                      reactTimeline,
                      tools: msg.tools.map((t) =>
                        t.step === step && t.status === "running"
                          ? { ...t, result, status: "done" }
                          : t,
                      ),
                    };
                  }

                  // --- Think 段落 ---
                  case "think_start": {
                    const thoughts = [...(msg.thoughts || [])];
                    const reactTimeline = (msg.reactTimeline || []).map((item) =>
                      item.type === "think" ? { ...item, isStreaming: false } : item,
                    );
                    reactTimeline.push({ type: "think", content: "", isStreaming: true });
                    return { ...msg, thoughts, reactTimeline };
                  }

                  case "think_chunk": {
                    const { content } = data as { content: string };
                    const thoughts = [...(msg.thoughts || [])];
                    const reactTimeline = (msg.reactTimeline || []).map((item) =>
                      item.type === "think" ? { ...item, isStreaming: true } : item,
                    );
                    const lastIdx = reactTimeline.length - 1;
                    const last = lastIdx >= 0 ? reactTimeline[lastIdx] : undefined;

                    if (last && last.type === "think") {
                      reactTimeline[lastIdx] = {
                        ...last,
                        content: last.content + content,
                        isStreaming: true,
                      };
                      const tIdx = thoughts.length - 1;
                      if (tIdx >= 0) {
                        thoughts[tIdx] += content;
                      } else {
                        thoughts.push(content);
                      }
                    } else {
                      thoughts.push(content);
                      reactTimeline.push({
                        type: "think",
                        content,
                        isStreaming: true,
                      });
                    }
                    return { ...msg, thoughts, reactTimeline };
                  }

                  case "think_end": {
                    const reactTimeline = (msg.reactTimeline || []).map((item) =>
                      item.type === "think" ? { ...item, isStreaming: false } : item,
                    );
                    return { ...msg, reactTimeline };
                  }

                  // --- 正文内容 ---
                  case "token":
                  case "content_chunk": {
                    const { content: chunk } = data as { content: string };
                    return { ...msg, content: msg.content + chunk };
                  }

                  // --- 业务 Patch（如 draft_patch） ---
                  case "patch": {
                    onPatch?.(data as TContext);
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
          const errMsg = error instanceof Error ? error.message : "请求失败";
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsg.id
                ? { ...msg, content: msg.content || `请求失败：${errMsg}` }
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
    [endpoint, headers, onPatch, onFrame],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
  }, []);

  const replaceMessages = useCallback((msgs: AgentMessage[]) => {
    setMessages(msgs);
  }, []);

  return { messages, isStreaming, sendMessage, abort, reset, replaceMessages };
}
