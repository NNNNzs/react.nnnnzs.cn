"use client";

/**
 * 聊天页面
 * 使用 Ant Design X 组件实现知识库检索对话
 * 使用 ReAct Agent 驱动的 RAG 架构
 * 支持多轮 ReAct 循环步骤展示和打字机效果
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import {
  UserOutlined,
  RobotOutlined,
  ClearOutlined,
  BulbOutlined,
  SearchOutlined,
  FileTextOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { Bubble, Sender, Think } from "@ant-design/x";
import XMarkdown from "@ant-design/x-markdown";
import { Typography, Button, Collapse, message as antdMessage } from "antd";
import type { StepType } from "@/lib/stream-tags";

const { Title } = Typography;

/**
 * 单个 ReAct 步骤
 */
interface ReactStep {
  type: StepType;
  content: string;
  isStreaming?: boolean;
}

/**
 * 一轮 ReAct 循环（thought + action + observation）
 */
interface ReactLoop {
  index: number;
  steps: ReactStep[];
}

/**
 * 消息类型定义
 */
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thoughts: string[];
  reactLoops: ReactLoop[];
  loading?: boolean;
  expanded?: boolean;
}

/**
 * 步骤图标和标签配置
 */
const STEP_CONFIG: Record<
  StepType,
  { icon: React.ReactNode; label: string; color: string }
> = {
  thought: { icon: <BulbOutlined />, label: "思考", color: "#faad14" },
  action: { icon: <SearchOutlined />, label: "搜索", color: "#1890ff" },
  observation: { icon: <FileTextOutlined />, label: "结果", color: "#52c41a" },
};

/**
 * 过滤 thought 中的 JSON-RPC 代码块
 */
function filterJsonRpc(text: string): string {
  return text.replace(/```json-rpc\s*[\s\S]*?```/g, "").trim();
}

/**
 * ReactStepItem 组件 - 展示单个 ReAct 步骤
 */
const ReactStepItem: React.FC<{ step: ReactStep }> = React.memo(({ step }) => {
  const config = STEP_CONFIG[step.type];

  const displayContent = useMemo(() => {
    if (step.type !== "thought") return step.content;
    return step.isStreaming ? step.content : filterJsonRpc(step.content);
  }, [step.content, step.type, step.isStreaming]);

  if (!displayContent) return null;

  return (
    <div className="flex items-start gap-2 text-sm leading-relaxed">
      <span style={{ color: config.color, marginTop: 2 }}>{config.icon}</span>
      <span className="font-medium text-gray-500 shrink-0">{config.label}</span>
      <span className="text-gray-700">
        {displayContent}
        {step.isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-gray-400 ml-0.5 animate-pulse align-middle" />
        )}
      </span>
    </div>
  );
});

ReactStepItem.displayName = "ReactStepItem";

/**
 * MessageContent 组件属性
 */
interface MessageContentProps {
  content: string;
  thoughts: string[];
  reactLoops: ReactLoop[];
  loading?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}

/**
 * MessageContent 组件
 * 使用 Think 展示状态提示，Collapse 展示 ReAct 多轮循环，XMarkdown 展示最终答案
 */
const MessageContent: React.FC<MessageContentProps> = React.memo(
  ({
    content,
    thoughts = [],
    reactLoops = [],
    loading,
    expanded,
    onToggle,
  }) => {
    const thoughtContent = useMemo(() => {
      return thoughts.join("\n\n");
    }, [thoughts]);

    const [title, defaultExpanded] = useMemo(() => {
      if (loading) {
        return ["正在思考...", true];
      }
      return ["思考完成", false];
    }, [loading]);

    const isExpanded = expanded !== undefined ? expanded : defaultExpanded;

    const collapseItems = useMemo(() => {
      return reactLoops.map((loop) => ({
        key: `loop-${loop.index}`,
        label: (
          <span className="flex items-center gap-2">
            <span>第 {loop.index} 轮检索</span>
            {loop.steps.some((s) => s.isStreaming) && <LoadingOutlined />}
          </span>
        ),
        children: (
          <div className="space-y-2">
            {loop.steps.map((step, stepIdx) => (
              <ReactStepItem key={`${loop.index}-${stepIdx}`} step={step} />
            ))}
          </div>
        ),
      }));
    }, [reactLoops]);

    // 默认只展开最后一轮
    const defaultActiveKeys = useMemo(() => {
      if (reactLoops.length === 0) return [];
      return [`loop-${reactLoops[reactLoops.length - 1].index}`];
    }, [reactLoops]);

    return (
      <div>
        {loading &&
        !content &&
        thoughts.length === 0 &&
        reactLoops.length === 0 ? (
          <div className="text-gray-400 flex items-center gap-2">
            <RobotOutlined spin />
            <span>正在思考...</span>
          </div>
        ) : (
          <>
            {/* 状态提示（初始化信息） */}
            {thoughts.length > 0 && (
              <Think
                title={title}
                loading={loading}
                expanded={isExpanded}
                onClick={onToggle}
              >
                {thoughtContent}
              </Think>
            )}

            {/* ReAct 多轮循环展示 */}
            {reactLoops.length > 0 && (
              <Collapse
                size="small"
                defaultActiveKey={defaultActiveKeys}
                className="mb-3"
                items={collapseItems}
              />
            )}

            {/* 最终答案 */}
            {content && <XMarkdown>{content}</XMarkdown>}
          </>
        )}
      </div>
    );
  },
);

MessageContent.displayName = "MessageContent";

/**
 * 聊天页面组件
 */
export default function ChatPage() {
  const [content, setContent] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRequesting, setIsRequesting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 处理提交
   */
  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim() || isRequesting) {
        return;
      }

      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // 创建新的 AbortController
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // 添加用户消息
      const userMessageId = `user-${Date.now()}`;
      const userMessage: ChatMessage = {
        id: userMessageId,
        role: "user",
        content: text,
        thoughts: [],
        reactLoops: [],
      };

      // 添加 AI 消息占位符
      const aiMessageId = `ai-${Date.now()}`;
      const aiMessage: ChatMessage = {
        id: aiMessageId,
        role: "assistant",
        content: "",
        thoughts: [],
        reactLoops: [],
        loading: true,
        expanded: true,
      };

      setMessages((prev) => [...prev, userMessage, aiMessage]);
      setIsRequesting(true);
      setContent("");

      try {
        // 发起流式请求
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: text,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        // 使用流式标签解析器
        const { processStreamResponseWithTags } = await import("@/lib/stream");
        await processStreamResponseWithTags(response, {
          onThink: (thinkContent) => {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;
                return { ...msg, thoughts: [...msg.thoughts, thinkContent] };
              }),
            );
          },
          onStep: (stepContent, stepType, stepIndex) => {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;

                const loops = [...msg.reactLoops];

                // 确保 loops 数组有足够长度
                while (loops.length < stepIndex) {
                  loops.push({ index: loops.length + 1, steps: [] });
                }

                const currentLoop = { ...loops[stepIndex - 1] };

                if (stepType === "thought") {
                  // thought 是流式的，追加到最后一个 thought 步骤
                  const lastStep =
                    currentLoop.steps[currentLoop.steps.length - 1];
                  if (
                    lastStep &&
                    lastStep.type === "thought" &&
                    lastStep.isStreaming
                  ) {
                    const updatedSteps = [...currentLoop.steps];
                    updatedSteps[updatedSteps.length - 1] = {
                      ...lastStep,
                      content: lastStep.content + stepContent,
                    };
                    currentLoop.steps = updatedSteps;
                  } else {
                    // 新建 thought 步骤，同时将前一个 thought 标记为完成
                    const updatedSteps = currentLoop.steps.map((s) =>
                      s.type === "thought" && s.isStreaming
                        ? { ...s, isStreaming: false }
                        : s,
                    );
                    currentLoop.steps = [
                      ...updatedSteps,
                      {
                        type: "thought",
                        content: stepContent,
                        isStreaming: true,
                      },
                    ];
                  }
                } else {
                  // action / observation 是完整的，将前一个 thought 标记为完成
                  const updatedSteps = currentLoop.steps.map((s) =>
                    s.type === "thought" && s.isStreaming
                      ? { ...s, isStreaming: false }
                      : s,
                  );
                  currentLoop.steps = [
                    ...updatedSteps,
                    {
                      type: stepType,
                      content: stepContent,
                      isStreaming: false,
                    },
                  ];
                }

                loops[stepIndex - 1] = currentLoop;
                return { ...msg, reactLoops: loops };
              }),
            );
          },
          onContent: (contentChunk) => {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;
                return { ...msg, content: msg.content + contentChunk };
              }),
            );
          },
          onComplete: () => {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;
                return {
                  ...msg,
                  loading: false,
                  expanded: false,
                  reactLoops: msg.reactLoops.map((loop) => ({
                    ...loop,
                    steps: loop.steps.map((step) => ({
                      ...step,
                      isStreaming: false,
                    })),
                  })),
                };
              }),
            );
          },
          onError: (error) => {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;
                return {
                  ...msg,
                  loading: false,
                  content: error.message,
                };
              }),
            );
          },
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? {
                  ...msg,
                  content: error instanceof Error ? error.message : "请求失败",
                  loading: false,
                }
              : msg,
          ),
        );
        antdMessage.error(error instanceof Error ? error.message : "请求失败");
      } finally {
        setIsRequesting(false);
        abortControllerRef.current = null;
      }
    },
    [isRequesting],
  );

  /**
   * 消息角色配置
   */
  const roles = useMemo(
    () => ({
      ai: {
        placement: "start" as const,
        avatar: () => <RobotOutlined />,
      },
      user: {
        placement: "end" as const,
        avatar: () => <UserOutlined />,
      },
    }),
    [],
  );

  /**
   * 清空消息
   */
  const handleClear = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages([]);
    setContent("");
    setIsRequesting(false);
  }, []);

  /**
   * 切换消息展开状态
   */
  const toggleMessageExpanded = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, expanded: !msg.expanded } : msg,
      ),
    );
  }, []);

  /**
   * 转换消息为 Bubble.List 需要的格式
   */
  const bubbleItems = useMemo(() => {
    return messages.map((msg) => {
      return {
        key: msg.id,
        role: msg.role,
        content:
          msg.role === "user" ? (
            msg.content
          ) : (
            <MessageContent
              content={msg.content}
              thoughts={msg.thoughts}
              reactLoops={msg.reactLoops}
              loading={msg.loading}
              expanded={msg.expanded}
              onToggle={() => toggleMessageExpanded(msg.id)}
            />
          ),
      };
    });
  }, [messages, toggleMessageExpanded]);

  /**
   * 设置 Markdown 中的链接在新标签页打开
   */
  const messageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleLinkClick = () => {
      if (messageContainerRef.current) {
        const links = messageContainerRef.current.querySelectorAll("a");
        links.forEach((link) => {
          if (!link.hasAttribute("target")) {
            link.setAttribute("target", "_blank");
            link.setAttribute("rel", "noopener noreferrer");
          }
        });
      }
    };

    handleLinkClick();

    const observer = new MutationObserver(handleLinkClick);
    if (messageContainerRef.current) {
      observer.observe(messageContainerRef.current, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [messages]);

  /**
   * 自动滚动到底部（流式响应时）
   */
  useEffect(() => {
    if (messageContainerRef.current && isRequesting) {
      requestAnimationFrame(() => {
        if (messageContainerRef.current) {
          messageContainerRef.current.scrollTop =
            messageContainerRef.current.scrollHeight;
        }
      });
    }
  }, [messages, isRequesting]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl h-[calc(100vh-var(--header-height))] flex flex-col overflow-hidden">
      <div className="mb-6 flex items-center justify-between gap-80">
        <div>
          <Title level={2} style={{ marginBottom: 16 }}>
            纸上余温
          </Title>
          <Typography.Text type="secondary" className="block">
            如果死后会幻化为书，这便是我提前整理出的草稿。它记录了代码的逻辑，也收纳了旅途的风尘。不必急于定义它是一本菜谱还是登记簿，只需开始对话，让故事发生。
          </Typography.Text>
        </div>
        {messages.length > 0 && (
          <Button
            icon={<ClearOutlined />}
            onClick={handleClear}
            disabled={isRequesting}
            danger
          >
            清空对话
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 消息列表 */}
        <div ref={messageContainerRef} className="h-full overflow-auto px-2">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Typography.Text type="secondary" className="text-center">
                &quot;我们读着别人，做着自己。很高兴在我的字里，遇见你的问题。&quot;
              </Typography.Text>
            </div>
          ) : (
            <Bubble.List role={roles} items={bubbleItems} />
          )}
        </div>
      </div>

      {/* 输入框 */}
      <div className="shrink-0 pt-2">
        <Sender
          loading={isRequesting}
          value={content}
          onChange={setContent}
          onSubmit={handleSubmit}
          placeholder="输入您的问题，我会从知识库中检索相关内容并回答...例如你去过哪些地方旅游"
        />
      </div>
    </div>
  );
}
