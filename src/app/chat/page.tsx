"use client";

/**
 * 聊天页面
 * 使用 Ant Design X 组件实现知识库检索对话
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { flushSync } from "react-dom";
import { UserOutlined, RobotOutlined, ClearOutlined } from "@ant-design/icons";
import { Bubble, Sender, Think } from "@ant-design/x";
import XMarkdown from "@ant-design/x-markdown";
import { Typography, Button, message as antdMessage } from "antd";
import { fetchAndProcessStreamWithTags } from "@/lib/stream";

const { Title } = Typography;

/**
 * 消息类型定义
 */
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  think?: string; // 思考内容（独立字段）
  loading?: boolean;
  streamStatus?: "streaming" | "done";
}

/**
 * MessageContent 组件属性
 */
interface MessageContentProps {
  content: string;
  think?: string; // 思考内容（独立字段）
  streamStatus?: "streaming" | "done";
}

/**
 * MessageContent 组件
 * Think 组件包裹着 XMarkdown 组件
 * 使用 key 强制在内容变化时重新渲染
 */
const MessageContent: React.FC<MessageContentProps> = ({
  content,
  think,
  streamStatus,
}) => {
  const isLoading = streamStatus === "streaming";
  const hasThink = !!think;

  // 如果有思考内容，用 Think 组件包裹
  if (hasThink) {
    const title = isLoading ? "思考中..." : "思考完成";
    return (
      <>
        <Think title={title} blink loading={isLoading}>
          {/* 思考内容 */}
          <div style={{ marginBottom: content ? 16 : 0 }}>
            {think}
          </div>
        </Think>
        {/* 实际内容 - 使用 streaming 属性启用流式渲染 */}
        {content && (
          <XMarkdown
            content={content}
            paragraphTag="div"
            streaming={{ hasNextChunk: isLoading }}
          />
        )}
      </>
    );
  }

  // 没有思考内容时，直接显示内容
  if (isLoading && !content) {
    return <div>正在生成回答...</div>;
  }

  // 使用 streaming 属性启用流式渲染
  return (
    <XMarkdown
      content={content}
      paragraphTag="div"
      streaming={{ hasNextChunk: isLoading }}
    />
  );
};




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
      };

      // 添加 AI 消息占位符
      const aiMessageId = `ai-${Date.now()}`;
      const aiMessage: ChatMessage = {
        id: aiMessageId,
        role: "assistant",
        content: "",
        loading: true,
        streamStatus: "streaming",
      };

      setMessages((prev) => [...prev, userMessage, aiMessage]);
      setIsRequesting(true);
      setContent("");

      try {
        // 构建历史记录（只包含用户和助手的内容，不包括当前消息）
        // 注意：这里使用 messages 状态，因为我们在添加新消息之前构建历史
        const historyForRequest = messages
          .filter(
            (msg) =>
              msg.role === "user" || (msg.role === "assistant" && !msg.loading)
          )
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          }))
          .slice(-10); // 只使用最近10条消息

        // 使用封装的流式处理函数（带标签解析）
        await fetchAndProcessStreamWithTags(
          "/api/chat",
          {
            method: "POST",
            body: JSON.stringify({
              message: text,
              history: historyForRequest,
            }),
            signal: abortController.signal,
          },
          {
            onThink: (thinkContent) => {
              // 立即更新消息，设置 think 字段（即使 content 还是空的）
              // 使用 flushSync 强制立即渲染，避免 React 批处理延迟
              console.log('🔵 onThink 回调被调用，内容长度:', thinkContent.length);
              flushSync(() => {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== aiMessageId) return msg;

                    return {
                      ...msg,
                      think: thinkContent, // 直接设置 think 字段
                      loading: true,
                      streamStatus: "streaming",
                    };
                  })
                );
              });
              console.log('✅ onThink 状态已更新');
            },
            onContent: (contentChunk) => {
              // content 标签内容，流式追加到 content 字段
              // 使用 flushSync 强制立即渲染，实现真正的流式显示
              // console.log('🟢 onContent 回调被调用，块长度:', contentChunk.length, '内容预览:', contentChunk.substring(0, 50));

              // 直接更新状态，使用 flushSync 强制同步渲染
              flushSync(() => {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== aiMessageId) return msg;

                    // 获取当前内容，流式追加
                    const currentContent = msg.content || "";
                    console.log('🟢 contentChunk:', contentChunk);
                    const newContent = currentContent + contentChunk;

                    return {
                      ...msg,
                      content: newContent, // 只更新 content 字段
                      loading: true,
                      streamStatus: "streaming",
                    };
                  })
                );
              });

            },
            onComplete: () => {
              // 完成
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId
                    ? {
                      ...msg,
                      loading: false,
                      streamStatus: "done",
                    }
                    : msg
                )
              );
              setIsRequesting(false);
            },
            onError: (error) => {
              // 错误处理
              if (error instanceof Error && error.name === "AbortError") {
                // 请求被取消，不显示错误
                return;
              }
              console.error("流式响应错误:", error);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId
                    ? {
                      ...msg,
                      content:
                        msg.content || "抱歉，处理请求时出现错误，请重试。",
                      loading: false,
                      streamStatus: "done",
                    }
                    : msg
                )
              );
              setIsRequesting(false);
              antdMessage.error(error.message || "请求失败");
            },
          }
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // 请求被取消，不显示错误
          return;
        }

        console.error("请求错误:", error);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? {
                ...msg,
                content: error instanceof Error ? error.message : "请求失败",
                loading: false,
                streamStatus: "done",
              }
              : msg
          )
        );
        setIsRequesting(false);
        antdMessage.error(error instanceof Error ? error.message : "请求失败");
      } finally {
        abortControllerRef.current = null;
      }
    },
    [isRequesting, messages]
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
   * 转换消息为 Bubble.List 需要的格式
   * 不使用 useMemo，直接计算，确保每次 messages 更新时都重新计算
   */
  const bubbleItems = messages.map((msg) => {
    const isLoading = msg.loading || msg.streamStatus === "streaming";

    return {
      key: msg.id,
      loading: isLoading,
      role: msg.role,
      // 使用 MessageContent 组件渲染助手消息，用户消息保持纯文本
      content:
        msg.role === "user" ? (
          msg.content
        ) : (
          <MessageContent
            content={msg.content}
            think={msg.think}
            streamStatus={msg.streamStatus}
          />
        ),
    };
  });

  /**
   * 设置 Markdown 中的链接在新标签页打开
   */
  const messageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 为所有 Markdown 渲染的链接添加 target="_blank"
    const handleLinkClick = () => {
      if (messageContainerRef.current) {
        const links = messageContainerRef.current.querySelectorAll("a");
        links.forEach((link) => {
          // 只处理外部链接或相对路径链接，内部链接也打开新标签页
          if (!link.hasAttribute("target")) {
            link.setAttribute("target", "_blank");
            link.setAttribute("rel", "noopener noreferrer");
          }
        });
      }
    };

    // 初始设置
    handleLinkClick();

    // 使用 MutationObserver 监听 DOM 变化（流式响应时内容会动态添加）
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
  }, [messages]); // 改为依赖 messages，确保每次消息更新时都执行

  /**
   * 自动滚动到底部（流式响应时）
   */
  useEffect(() => {
    if (messageContainerRef.current && isRequesting) {
      // 使用 requestAnimationFrame 确保在 DOM 更新后滚动
      requestAnimationFrame(() => {
        if (messageContainerRef.current) {
          messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
        }
      });
    }
  }, [messages, isRequesting]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl h-[calc(100vh-var(--header-height))] flex flex-col overflow-hidden">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Title level={2} style={{ marginBottom: 16 }}>
            💬 知识库智能对话
          </Title>
          <Typography.Text type="secondary" className="block">
            基于知识库检索的智能对话，支持展示思考过程和检索结果
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
                开始对话吧！我会从知识库中检索相关内容并回答您的问题。
              </Typography.Text>
            </div>
          ) : (
            <Bubble.List
              role={roles}
              items={bubbleItems}
            />
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
          placeholder="输入您的问题，我会从知识库中检索相关内容并回答..."
        />
      </div>
    </div>
  );
}
