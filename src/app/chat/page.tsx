"use client";

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
  PlusOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Bubble, Sender } from "@ant-design/x";
import {
  Typography,
  Button,
  message,
  List,
  Popconfirm,
  Spin,
  Modal,
  Input,
  Empty,
} from "antd";
import dayjs from "dayjs";
import { getDeviceId } from "@/lib/device-id";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useHeaderStyle } from "@/contexts/HeaderStyleContext";
import { chatStyleCopy } from "@/config/site-copy/chat";
import { commonStyleCopy } from "@/config/site-copy/common";
import { selectStyleText } from "@/lib/site-style/copy";
import { useStyleVariant } from "@/lib/site-style/useStyleVariant";
import type { SiteStyleVariant } from "@/lib/site-style/variant";
import { useAgentStream } from "@/hooks/useAgentStream";
import { useExternalLinks } from "@/hooks/useExternalLinks";
import { useSmartAutoScroll } from "@/hooks/useSmartAutoScroll";
import { AgentMessageContent } from "@/components/agent/AgentMessageContent";
import type { AgentStyleCopy } from "@/components/agent/AgentMessageContent";
import type { AgentMessage } from "@/types/agent-stream";

const { Title, Text } = Typography;

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
  styleVariant: SiteStyleVariant;
}> = React.memo(({
  sessions,
  activeSessionId,
  loading,
  searchText,
  onSearchTextChange,
  onSelect,
  onNew,
  onDelete,
  styleVariant,
}) => {
  const filteredSessions = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return sessions;

    return sessions.filter((session) => {
      const title = session.title || selectStyleText(chatStyleCopy.newSession, styleVariant);
      const time = dayjs(session.updated_at).format("YYYY-MM-DD HH:mm");
      return `${title} ${time}`.toLowerCase().includes(keyword);
    });
  }, [searchText, sessions, styleVariant]);

  return (
    <div className="chat-session-palette flex max-h-[68vh] flex-col overflow-hidden">
      <Input
        allowClear
        autoFocus
        prefix={<SearchOutlined />}
        value={searchText}
        onChange={(event) => onSearchTextChange(event.target.value)}
        onPressEnter={() => {
          const firstSession = filteredSessions[0];
          if (firstSession) {
            onSelect(firstSession.id);
          }
        }}
        placeholder={selectStyleText(chatStyleCopy.sessionSearchPlaceholder, styleVariant)}
        size="large"
        className="chat-session-search mb-4"
      />

      <div className="chat-session-meta mb-3 flex items-center justify-between text-xs text-gray-400 dark:text-slate-400">
        <span>{selectStyleText(chatStyleCopy.recentSessions, styleVariant)}</span>
        <span>{selectStyleText(chatStyleCopy.commandHint, styleVariant)}</span>
      </div>

      {/* 会话列表 */}
      <div className="chat-session-list-wrap min-h-0 flex-1 overflow-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spin />
          </div>
        ) : filteredSessions.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={searchText
              ? selectStyleText(chatStyleCopy.noMatchedSession, styleVariant)
              : selectStyleText(chatStyleCopy.noSessionHistory, styleVariant)}
          />
        ) : (
          <List
            size="small"
            className="chat-session-list"
            dataSource={filteredSessions}
            renderItem={(session) => (
              <List.Item
                className={`chat-session-item mb-2 cursor-pointer rounded-xl border px-3 py-3 transition-all hover:border-blue-200 hover:bg-blue-50/60 dark:hover:border-slate-500 dark:hover:bg-slate-700/70 ${
                  activeSessionId === session.id
                    ? "chat-session-item-active border-blue-300 bg-blue-50 shadow-sm dark:border-blue-500/60 dark:bg-blue-950/40"
                    : "border-stone-100 bg-white/80 dark:border-slate-700 dark:bg-slate-900/80"
                }`}
                onClick={() => onSelect(session.id)}
                actions={[
                  <Popconfirm
                    key="delete"
                    title={selectStyleText(chatStyleCopy.deleteSessionConfirm, styleVariant)}
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      onDelete(session.id);
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                  >
                    <Button variant="text" color="danger"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>,
                ]}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate text-slate-900 dark:text-slate-100">
                    {session.title || selectStyleText(chatStyleCopy.newSession, styleVariant)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 dark:text-slate-400">
                    {dayjs(session.updated_at).format('MM-DD HH:mm')} · {session.message_count}
                    {selectStyleText(chatStyleCopy.messageCountUnit, styleVariant)}
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </div>

      <div className="chat-session-footer mt-4 border-t border-gray-100 pt-4 dark:border-slate-700">
        <Button color="primary" variant="solid" icon={<PlusOutlined />} onClick={onNew} block>
          {selectStyleText(chatStyleCopy.newSession, styleVariant)}
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
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionPaletteOpen, setSessionPaletteOpen] = useState(false);
  const [sessionSearchText, setSessionSearchText] = useState("");
  const [loadingSession, setLoadingSession] = useState(false);

  const { isMobile } = useBreakpoint();
  const { setHeaderStyle, resetHeaderStyle } = useHeaderStyle();
  const styleVariant = useStyleVariant();

  const { messages, isStreaming, sendMessage, abort, reset, replaceMessages } =
    useAgentStream<unknown>({
      endpoint: "/api/chat",
      headers: {},
      onFrame: () => {
        // 可以在这里处理原始 SSE 帧（如埋点）
      },
    });

  const messageContainerRef = useRef<HTMLDivElement>(null);

  const { onScroll: handleMessageScroll } = useSmartAutoScroll(
    messageContainerRef,
    isStreaming,
    [messages, isStreaming],
  );

  useExternalLinks(messageContainerRef, [messages]);

  // 构建样式文案配置
  const styleCopy: AgentStyleCopy = useMemo(
    () => ({
      thinking: selectStyleText(chatStyleCopy.thinking, styleVariant),
      thinkSegment: selectStyleText(chatStyleCopy.thinkSegment, styleVariant),
      thinkComplete: selectStyleText(chatStyleCopy.thinkComplete, styleVariant),
      retrievalRoundPrefix: selectStyleText(chatStyleCopy.retrievalRoundPrefix, styleVariant),
      retrievalRoundSuffix: selectStyleText(chatStyleCopy.retrievalRoundSuffix, styleVariant),
    }),
    [styleVariant],
  );

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

      const response = await fetch("/api/chat/sessions", {
        headers,
        cache: "no-store",
      });
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

      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        headers,
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status && data.data) {
          const sessionMessages: AgentMessage[] = (data.data.messages || []).map(
            (msg: {
              id: number;
              role: string;
              content: string;
              metadata: {
                thoughts?: string[];
                reactLoops?: Array<{
                  index: number;
                  steps: Array<{
                    type: string;
                    content: string;
                    toolName?: string;
                    startedAt?: string;
                    endedAt?: string;
                    durationMs?: number;
                  }>;
                }>;
                reactTimeline?: Array<
                  | { type: "think"; content: string }
                  | {
                      type: "loop";
                      index: number;
                      steps: Array<{
                        type: string;
                        content: string;
                        toolName?: string;
                        startedAt?: string;
                        endedAt?: string;
                        durationMs?: number;
                      }>;
                    }
                >;
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
                  isStreaming: false,
                })),
              })),
              reactTimeline: (msg.metadata?.reactTimeline || []).map((item) =>
                item.type === "think"
                  ? {
                      type: "think" as const,
                      content: item.content,
                      isStreaming: false,
                    }
                  : {
                      type: "loop" as const,
                      index: item.index,
                      steps: item.steps.map((step) => ({
                        ...step,
                        isStreaming: false,
                      })),
                    },
              ),
            }),
          );

          replaceMessages(sessionMessages);
          setActiveSessionId(sessionId);
        }
      }
    } catch {
      messageApi.error(selectStyleText(chatStyleCopy.loadSessionFailed, styleVariant));
    } finally {
      setLoadingSession(false);
    }
  }, [messageApi, replaceMessages, styleVariant]);

  /**
   * 页面加载时获取会话列表
   */
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  /**
   * 每次打开会话记录弹窗都重新请求，确保异步生成的标题能及时显示。
   */
  useEffect(() => {
    if (sessionPaletteOpen) {
      loadSessions();
    }
  }, [sessionPaletteOpen, loadSessions]);

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
    reset();
    setActiveSessionId(null);
    setContent("");
    setSessionPaletteOpen(false);
    setSessionSearchText("");
  }, [reset]);

  /**
   * 选择会话
   */
  const handleSelectSession = useCallback(
    (id: number) => {
      if (id === activeSessionId) {
        setSessionPaletteOpen(false);
        setSessionSearchText("");
        return;
      }
      loadSessionMessages(id);
      setSessionPaletteOpen(false);
      setSessionSearchText("");
    },
    [activeSessionId, loadSessionMessages],
  );

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
        messageApi.success(selectStyleText(chatStyleCopy.deleteSuccess, styleVariant));
        if (id === activeSessionId) {
          reset();
          setActiveSessionId(null);
        }
        loadSessions();
      }
    } catch {
      messageApi.error(selectStyleText(chatStyleCopy.deleteFailed, styleVariant));
    }
  }, [activeSessionId, loadSessions, messageApi, reset, styleVariant]);

  /**
   * 处理提交
   */
  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) {
        return;
      }

      // 取消之前的请求
      abort();

      const history = messages
        .filter((msg) => msg.content)
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
          thoughts: msg.thoughts,
          reactLoops: msg.reactLoops,
          reactTimeline: msg.reactTimeline,
        }));

      await sendMessage(text, history);
      setContent("");
    },
    [isStreaming, messages, sendMessage, abort],
  );

  /**
   * 清空消息
   */
  const handleClear = useCallback(() => {
    abort();
    reset();
    setContent("");
  }, [abort, reset]);

  /**
   * 消息角色配置
   */
  const roles = useMemo(
    () => ({
      ai: {
        placement: "start" as const,
        avatar: () => <RobotOutlined />,
        classNames: {
          content: "chat-bubble-content chat-bubble-content-ai",
          avatar: "chat-bubble-avatar",
        },
      },
      user: {
        placement: "end" as const,
        avatar: () => <UserOutlined />,
        classNames: {
          content: "chat-bubble-content chat-bubble-content-user",
          avatar: "chat-bubble-avatar",
        },
      },
    }),
    [],
  );

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
            <AgentMessageContent
              content={msg.content}
              thoughts={msg.thoughts || []}
              reactLoops={msg.reactLoops || []}
              reactTimeline={msg.reactTimeline || []}
              isLoading={isStreaming && msg.role === "assistant"}
              variant="default"
              styleCopy={styleCopy}
            />
          ),
      };
    });
  }, [messages, isStreaming, styleCopy]);

  const activeSession = useMemo(() => {
    if (!activeSessionId) return null;
    return sessions.find((session) => session.id === activeSessionId) || null;
  }, [activeSessionId, sessions]);

  return (
    <div className="chat-page-shell h-[calc(100vh-var(--header-height))] overflow-hidden bg-background-light px-3 py-4 dark:bg-background-dark sm:px-5">
      {messageContextHolder}
      <Modal
        title={selectStyleText(chatStyleCopy.sessionHistory, styleVariant)}
        open={sessionPaletteOpen}
        onCancel={() => setSessionPaletteOpen(false)}
        footer={null}
        width={isMobile ? "calc(100vw - 32px)" : 640}
        rootClassName="chat-session-modal-root"
        className="chat-session-modal"
        classNames={{
          header: "chat-session-modal-header",
          body: "chat-session-modal-body",
          title: "chat-session-modal-title",
          wrapper: "chat-session-modal-wrapper",
          mask: "chat-session-modal-mask",
        }}
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
          styleVariant={styleVariant}
        />
      </Modal>

      {/* 主聊天区域 */}
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border-light bg-card-light shadow-sm dark:border-border-dark dark:bg-card-dark">
        <div className="shrink-0 border-b border-border-light px-4 py-4 dark:border-border-dark sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                  {selectStyleText(chatStyleCopy.pageKicker, styleVariant)}
                </span>
                <span className="text-xs text-text-muted-light dark:text-text-muted-dark">
                  {activeSession
                    ? `${selectStyleText(chatStyleCopy.activeSessionPrefix, styleVariant)} · ${activeSession.message_count} ${selectStyleText(chatStyleCopy.messageCountUnit, styleVariant)}`
                    : selectStyleText(chatStyleCopy.newSessionMeta, styleVariant)}
                </span>
              </div>
              <Title level={2} className="!mb-2 !text-text-main-light dark:!text-text-main-dark">
                {selectStyleText(chatStyleCopy.pageTitle, styleVariant)}
              </Title>
              <Text type="secondary" className="block max-w-3xl leading-6 dark:!text-text-muted-dark">
                {selectStyleText(chatStyleCopy.pageDescription, styleVariant)}
              </Text>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                icon={<ClockCircleOutlined />}
                onClick={() => setSessionPaletteOpen(true)}
              >
                {isMobile
                  ? selectStyleText(chatStyleCopy.sessionHistoryShort, styleVariant)
                  : selectStyleText(chatStyleCopy.sessionHistory, styleVariant)}
              </Button>
              <Button icon={<PlusOutlined />} onClick={handleNewSession}>
                {isMobile
                  ? selectStyleText(chatStyleCopy.newSessionShort, styleVariant)
                  : selectStyleText(chatStyleCopy.newSession, styleVariant)}
              </Button>
              {messages.length > 0 && (
                <Button
                  icon={<ClearOutlined />}
                  onClick={handleClear}
                  disabled={isStreaming}
                  danger
                >
                  {selectStyleText(commonStyleCopy.clear, styleVariant)}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/60 dark:bg-slate-950/30">
          {/* 消息列表 */}
          <div
            ref={messageContainerRef}
            onScroll={handleMessageScroll}
            className="min-h-0 flex-1 overflow-auto px-3 py-4 sm:px-6"
          >
            {loadingSession ? (
              <div className="flex items-center justify-center h-full">
                <Spin tip={selectStyleText(chatStyleCopy.loadingSession, styleVariant)} />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <Text type="secondary" className="text-center dark:!text-text-muted-dark">
                  {selectStyleText(chatStyleCopy.emptyMessage, styleVariant)}
                </Text>
              </div>
            ) : (
              <Bubble.List role={roles} items={bubbleItems} />
            )}
          </div>

          {/* 输入框 */}
          <div className="shrink-0 border-t border-border-light bg-card-light p-3 dark:border-border-dark dark:bg-card-dark sm:p-4">
            <Sender
              loading={isStreaming}
              value={content}
              onChange={setContent}
              onSubmit={handleSubmit}
              placeholder={selectStyleText(chatStyleCopy.inputPlaceholder, styleVariant)}
              rootClassName="chat-sender"
              classNames={{
                content: "chat-sender-content",
                input: "chat-sender-input",
                suffix: "chat-sender-suffix",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
