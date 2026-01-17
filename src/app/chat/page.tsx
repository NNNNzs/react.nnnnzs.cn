"use client";

/**
 * 聊天页面
 * 使用 Ant Design X 组件实现知识库检索对话
 * 使用简单 RAG 架构（单步检索 → 生成）
 * 支持 Think 组件展示思考过程和打字机效果
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
} from "@ant-design/icons";
import { Bubble, Sender, Think } from "@ant-design/x";
import XMarkdown from "@ant-design/x-markdown";
import { Typography, Button, message as antdMessage } from "antd";

const { Title } = Typography;

/**
 * 消息类型定义
 */
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thoughts: string[]; // 思考过程列表
  loading?: boolean;
  expanded?: boolean; // 思考面板展开状态
}

/**
 * MessageContent 组件属性
 */
interface MessageContentProps {
  content: string;
  thoughts: string[];
  loading?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}

/**
 * MessageContent 组件
 * 使用 Think 组件展示思考过程和最终答案
 */
const MessageContent: React.FC<MessageContentProps> = React.memo(({
  content,
  thoughts = [],
  loading,
  expanded,
  onToggle,
}) => {
  // 将所有思考内容合并为一个字符串
  const thoughtContent = useMemo(() => {
    return thoughts.join('\n\n---\n\n');
  }, [thoughts]);

  // 使用 useMemo 计算标题和展开状态
  const [title, defaultExpanded] = useMemo(() => {
    if (loading) {
      return ['正在思考...', true];
    } else {
      return ['思考完成', false];
    }
  }, [loading]);

  // 优先使用传入的 expanded，否则使用默认值
  const isExpanded = expanded !== undefined ? expanded : defaultExpanded;

  return (
    <div>
      {loading && !content && thoughts.length === 0 ? (
        <div className="text-gray-400 flex items-center gap-2">
          <RobotOutlined spin />
          <span>正在思考...</span>
        </div>
      ) : (
        <>
          {/* 思考过程折叠面板 */}
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

          {/* 正文内容 */}
          {content && <XMarkdown>{content}</XMarkdown>}
        </>
      )}
    </div>
  );
});

MessageContent.displayName = 'MessageContent';

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
      };

      // 添加 AI 消息占位符
      const aiMessageId = `ai-${Date.now()}`;
      const aiMessage: ChatMessage = {
        id: aiMessageId,
        role: "assistant",
        content: "",
        thoughts: [],
        loading: true,
        expanded: true, // 初始展开
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
        const { processStreamResponseWithTags } = await import('@/lib/stream');
        await processStreamResponseWithTags(response, {
          onThink: (thinkContent) => {
            console.log('💭 思考:', thinkContent);
            // 添加到思考列表
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;

                return {
                  ...msg,
                  thoughts: [...msg.thoughts, thinkContent],
                };
              })
            );
          },
          onContent: (contentChunk) => {
            // 累积内容
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;

                const newContent = msg.content + contentChunk;
                return {
                  ...msg,
                  content: newContent,
                };
              })
            );
          },
          onComplete: () => {
            console.log('✅ 流式响应完成');
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;

                return {
                  ...msg,
                  loading: false,
                  expanded: false, // 完成后自动折叠
                };
              })
            );
          },
          onError: (error) => {
            console.error('❌ 流式响应错误:', error);
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;

                return {
                  ...msg,
                  loading: false,
                  content: error.message,
                };
              })
            );
          },
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // 请求被取消，不显示错误
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
              : msg
          )
        );
        antdMessage.error(error instanceof Error ? error.message : "请求失败");
      } finally {
        setIsRequesting(false);
        abortControllerRef.current = null;
      }
    },
    [isRequesting]
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
    []
  );

  /**
   * 清空消息
   */
  const handleClear = useCallback(() => {
    // 取消进行中的请求
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
        msg.id === messageId ? { ...msg, expanded: !msg.expanded } : msg
      )
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
                “我们读着别人，做着自己。很高兴在我的字里，遇见你的问题。”
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
