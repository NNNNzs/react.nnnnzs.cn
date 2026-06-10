"use client";

/**
 * 聊天页面
 * 使用 Ant Design X 组件实现知识库检索对话
 * 使用 ReAct Agent 驱动的 RAG 架构
 * 支持多轮 ReAct 循环步骤展示和打字机效果
 * 支持会话列表、历史记录恢复
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
  PlusOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { Bubble, Sender, Think } from "@ant-design/x";
import XMarkdown from "@ant-design/x-markdown";
import {
  Typography,
  Button,
  Collapse,
  message,
  List,
  Popconfirm,
  Spin,
  Modal,
  Input,
  Empty,
} from "antd";
import dayjs from "dayjs";
import type { StepType } from "@/lib/stream-tags";
import { getDeviceId } from "@/lib/device-id";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useHeaderStyle } from "@/contexts/HeaderStyleContext";

const { Title, Text } = Typography;

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
 * 会话摘要类型
 */
interface SessionSummary {
  id: number;
  title: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
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
 * 会话命令面板组件
 */
const SessionCommandPalette: React.FC<{
  sessions: SessionSummary[];
  activeSessionId: number | null;
  loading: boolean;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
}> = React.memo(({
  sessions,
  activeSessionId,
  loading,
  searchText,
  onSearchTextChange,
  onSelect,
  onNew,
  onDelete,
}) => {
  const filteredSessions = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return sessions;

    return sessions.filter((session) => {
      const title = session.title || "新对话";
      const time = dayjs(session.updated_at).format("YYYY-MM-DD HH:mm");
      return `${title} ${time}`.toLowerCase().includes(keyword);
    });
  }, [searchText, sessions]);

  return (
    <div className="flex max-h-[68vh] flex-col overflow-hidden">
      <Input
        allowClear
        autoFocus
        prefix={<SearchOutlined className="text-gray-400" />}
        value={searchText}
        onChange={(event) => onSearchTextChange(event.target.value)}
        onPressEnter={() => {
          const firstSession = filteredSessions[0];
          if (firstSession) {
            onSelect(firstSession.id);
          }
        }}
        placeholder="搜索对话记录"
        size="large"
        className="mb-4"
      />

      <div className="mb-3 flex items-center justify-between text-xs text-gray-400">
        <span>最近会话</span>
        <span>Enter 打开首项 · Esc 关闭</span>
      </div>

      {/* 会话列表 */}
      <div className="min-h-0 flex-1 overflow-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spin />
          </div>
        ) : filteredSessions.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={searchText ? "没有匹配的对话" : "暂无对话记录"}
          />
        ) : (
          <List
            size="small"
            dataSource={filteredSessions}
            renderItem={(session) => (
              <List.Item
                className={`mb-2 cursor-pointer rounded-xl border px-3 py-3 transition-all hover:border-blue-200 hover:bg-blue-50/60 dark:hover:bg-gray-700 ${
                  activeSessionId === session.id
                    ? "border-blue-300 bg-blue-50 shadow-sm dark:bg-blue-900/20"
                    : "border-stone-100 bg-white/80 dark:border-gray-700 dark:bg-gray-800"
                }`}
                onClick={() => onSelect(session.id)}
                actions={[
                  <Popconfirm
                    key="delete"
                    title="确定删除这个对话？"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      onDelete(session.id);
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>,
                ]}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{session.title || '新对话'}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {dayjs(session.updated_at).format('MM-DD HH:mm')} · {session.message_count}条消息
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <Button type="primary" icon={<PlusOutlined />} onClick={onNew} block>
          新建对话
        </Button>
      </div>
    </div>
  );
});

SessionCommandPalette.displayName = "SessionCommandPalette";

/**
 * 聊天页面组件
 */
export default function ChatPage() {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [content, setContent] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRequesting, setIsRequesting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 会话相关状态
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionPaletteOpen, setSessionPaletteOpen] = useState(false);
  const [sessionSearchText, setSessionSearchText] = useState("");
  const [loadingSession, setLoadingSession] = useState(false);

  const { isMobile } = useBreakpoint();
  const { setHeaderStyle, resetHeaderStyle } = useHeaderStyle();

  /**
   * 聊天页使用正常文档流 Header，避免 fixed Header 遮挡顶部内容。
   */
  useEffect(() => {
    setHeaderStyle({
      static: true,
      alwaysVisible: true,
    });

    return () => {
      resetHeaderStyle();
    };
  }, [setHeaderStyle, resetHeaderStyle]);

  /**
   * 加载会话列表
   */
  const loadSessions = useCallback(async () => {
    try {
      setSessionsLoading(true);
      const deviceId = getDeviceId();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (deviceId) {
        headers["X-Device-Id"] = deviceId;
      }

      const response = await fetch("/api/chat/sessions", { headers });
      if (response.ok) {
        const data = await response.json();
        if (data.status) {
          setSessions(data.data.record || []);
        }
      }
    } catch {
      // 静默失败
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  /**
   * 加载会话详情（消息列表）
   */
  const loadSessionMessages = useCallback(async (sessionId: number) => {
    try {
      setLoadingSession(true);
      const deviceId = getDeviceId();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (deviceId) {
        headers["X-Device-Id"] = deviceId;
      }

      const response = await fetch(`/api/chat/sessions/${sessionId}`, { headers });
      if (response.ok) {
        const data = await response.json();
        if (data.status && data.data) {
          const sessionMessages = (data.data.messages || []).map((msg: {
            id: number;
            role: string;
            content: string;
            metadata: {
              thoughts?: string[];
              reactLoops?: Array<{
                index: number;
                steps: Array<{ type: string; content: string }>;
              }>;
            } | null;
            created_at: string;
          }) => ({
            id: `db-${msg.id}`,
            role: msg.role as "user" | "assistant",
            content: msg.content,
            thoughts: msg.metadata?.thoughts || [],
            reactLoops: (msg.metadata?.reactLoops || []).map((loop) => ({
              ...loop,
              steps: loop.steps.map((step) => ({
                ...step,
                type: step.type as StepType,
                isStreaming: false,
              })),
            })),
          }));

          setMessages(sessionMessages);
          setActiveSessionId(sessionId);
        }
      }
    } catch {
      messageApi.error("加载对话记录失败");
    } finally {
      setLoadingSession(false);
    }
  }, [messageApi]);

  /**
   * 页面加载时获取会话列表
   */
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  /**
   * 使用常见命令面板快捷键打开会话记录。
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSessionPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  /**
   * 新建对话
   */
  const handleNewSession = useCallback(() => {
    setMessages([]);
    setActiveSessionId(null);
    setContent("");
    setSessionPaletteOpen(false);
    setSessionSearchText("");
  }, []);

  /**
   * 选择会话
   */
  const handleSelectSession = useCallback((id: number) => {
    if (id === activeSessionId) {
      setSessionPaletteOpen(false);
      setSessionSearchText("");
      return;
    }
    loadSessionMessages(id);
    setSessionPaletteOpen(false);
    setSessionSearchText("");
  }, [activeSessionId, loadSessionMessages]);

  /**
   * 删除会话
   */
  const handleDeleteSession = useCallback(async (id: number) => {
    try {
      const deviceId = getDeviceId();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (deviceId) {
        headers["X-Device-Id"] = deviceId;
      }

      const response = await fetch(`/api/chat/sessions/${id}`, {
        method: "DELETE",
        headers,
      });

      if (response.ok) {
        messageApi.success("删除成功");
        // 如果删除的是当前会话，清空消息
        if (id === activeSessionId) {
          setMessages([]);
          setActiveSessionId(null);
        }
        loadSessions();
      }
    } catch {
      messageApi.error("删除失败");
    }
  }, [activeSessionId, loadSessions, messageApi]);

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
        // 构建历史对话（排除当前正在添加的消息）
        const history = messages
          .filter((msg) => msg.id !== userMessageId && msg.id !== aiMessageId)
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));

        // 构建请求头（携带设备ID）
        const deviceId = getDeviceId();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (deviceId) {
          headers["X-Device-Id"] = deviceId;
        }

        // 发起流式请求
        const response = await fetch("/api/chat", {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: text,
            history,
            sessionId: activeSessionId || undefined,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        // 从响应头获取 sessionId
        const newSessionId = response.headers.get("X-Session-Id");
        if (newSessionId && !activeSessionId) {
          setActiveSessionId(parseInt(newSessionId, 10));
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
            // 服务端会在流结束后落库，稍后刷新避免列表短暂显示旧计数
            window.setTimeout(() => {
              loadSessions();
            }, 300);
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
        messageApi.error(error instanceof Error ? error.message : "请求失败");
      } finally {
        setIsRequesting(false);
        abortControllerRef.current = null;
      }
    },
    [isRequesting, messages, activeSessionId, loadSessions, messageApi],
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

  const activeSession = useMemo(() => {
    if (!activeSessionId) return null;
    return sessions.find((session) => session.id === activeSessionId) || null;
  }, [activeSessionId, sessions]);

  return (
    <div className="h-[calc(100vh-var(--header-height))] overflow-hidden bg-background-light px-3 py-4 dark:bg-background-dark sm:px-5">
      {messageContextHolder}
      <Modal
        title="对话记录"
        open={sessionPaletteOpen}
        onCancel={() => setSessionPaletteOpen(false)}
        footer={null}
        width={isMobile ? "calc(100vw - 32px)" : 640}
        destroyOnHidden
        afterClose={() => setSessionSearchText("")}
      >
        <SessionCommandPalette
          sessions={sessions}
          activeSessionId={activeSessionId}
          loading={sessionsLoading}
          searchText={sessionSearchText}
          onSearchTextChange={setSessionSearchText}
          onSelect={handleSelectSession}
          onNew={handleNewSession}
          onDelete={handleDeleteSession}
        />
      </Modal>

      {/* 主聊天区域 */}
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border-light bg-card-light shadow-sm dark:border-border-dark dark:bg-card-dark">
        <div className="shrink-0 border-b border-border-light px-4 py-4 dark:border-border-dark sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                  纸上余温
                </span>
                <span className="text-xs text-text-muted-light dark:text-text-muted-dark">
                  {activeSession
                    ? `当前会话 · ${activeSession.message_count} 条消息`
                    : "新会话"}
                </span>
              </div>
              <Title level={2} className="!mb-2 !text-text-main-light dark:!text-text-main-dark">
                纸上余温
              </Title>
              <Text type="secondary" className="block max-w-3xl leading-6">
                如果死后会幻化为书，这便是我提前整理出的草稿。它记录了代码的逻辑，也收纳了旅途的风尘。不必急于定义它是一本菜谱还是登记簿，只需开始对话，让故事发生。
              </Text>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                icon={<ClockCircleOutlined />}
                onClick={() => setSessionPaletteOpen(true)}
              >
                {isMobile ? "记录" : "对话记录"}
              </Button>
              <Button icon={<PlusOutlined />} onClick={handleNewSession}>
                {isMobile ? "新建" : "新建对话"}
              </Button>
              {messages.length > 0 && (
                <Button
                  icon={<ClearOutlined />}
                  onClick={handleClear}
                  disabled={isRequesting}
                  danger
                >
                  清空
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/60 dark:bg-slate-950/30">
          {/* 消息列表 */}
          <div
            ref={messageContainerRef}
            className="min-h-0 flex-1 overflow-auto px-3 py-4 sm:px-6"
          >
            {loadingSession ? (
              <div className="flex items-center justify-center h-full">
                <Spin tip="加载对话记录..." />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <Text type="secondary" className="text-center">
                  &quot;我们读着别人，做着自己。很高兴在我的字里，遇见你的问题。&quot;
                </Text>
              </div>
            ) : (
              <Bubble.List role={roles} items={bubbleItems} />
            )}
          </div>

          {/* 输入框 */}
          <div className="shrink-0 border-t border-border-light bg-card-light p-3 dark:border-border-dark dark:bg-card-dark sm:p-4">
            <Sender
              loading={isRequesting}
              value={content}
              onChange={setContent}
              onSubmit={handleSubmit}
              placeholder="输入问题，按 Enter 发送。我会从知识库中检索相关内容并回答..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
