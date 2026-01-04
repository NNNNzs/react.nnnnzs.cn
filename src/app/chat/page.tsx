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
import { UserOutlined, RobotOutlined, ClearOutlined } from "@ant-design/icons";
import { Bubble, Sender, Think } from "@ant-design/x";
import XMarkdown, { type ComponentProps } from "@ant-design/x-markdown";
import { Flex, Card, Typography, Button, message as antdMessage } from "antd";
import { StreamTagParser, type StreamTag } from "@/lib/stream-tags";

const { Title } = Typography;

/**
 * 消息类型定义
 */
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
  streamStatus?: "streaming" | "done";
}

/**
 * 聊天页面组件
 */
export default function ChatPage() {
  const [content, setContent] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRequesting, setIsRequesting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // 使用 ref 存储每个消息的思考组件展开状态，避免重新渲染时丢失
  const thinkExpandedRef = useRef<Map<string, boolean>>(new Map());
  // 使用 ref 存储最新的 messages，供组件内部访问，避免闭包问题
  const messagesRef = useRef<ChatMessage[]>([]);

  // 同步 messages 到 ref
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /**
   * 解析文本流
   * 使用标签解析器解析流式响应，实现逐字显示
   */
  const parseTextStream = useCallback(
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      onTag: (tag: StreamTag) => void,
      onComplete: () => void,
      onError: (error: Error) => void
    ) => {
      const parser = new StreamTagParser();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // 完成解析，处理剩余数据
            parser.finish(onTag);
            onComplete();
            break;
          }

          if (value) {
            // 使用解析器解析数据块
            parser.parseChunk(value, onTag);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          onError(error);
        }
      }
    },
    []
  );

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

        // 调用 API
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: text,
            history: historyForRequest,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: "请求失败" }));
          throw new Error(errorData.message || "请求失败");
        }

        if (!response.body) {
          throw new Error("响应体为空");
        }

        // 读取流式响应
        const reader = response.body.getReader();
        let thinkContent = "";
        let hasThink = false;

        await parseTextStream(
          reader,
          (tag) => {
            // 根据标签类型处理
            if (tag.type === "think") {
              // think 标签内容应该只设置一次，放在最前面
              if (!hasThink) {
                thinkContent = tag.content;
                hasThink = true;
              }
            } else if (tag.type === "content") {
              // content 标签内容，流式追加
              // 使用函数式更新，确保获取最新的内容
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== aiMessageId) return msg;

                  // 获取当前内容，提取已有的 content 部分（去掉 think 标签）
                  const currentContent = msg.content || "";
                  let existingContent = "";

                  if (currentContent.includes("</think>")) {
                    // 如果已有 think 标签，提取 content 部分
                    const contentStart = currentContent.indexOf("</think>") + 8;
                    existingContent = currentContent
                      .substring(contentStart)
                      .replace(/^\n\n/, "");
                  } else {
                    // 如果没有 think 标签，使用全部内容
                    existingContent = currentContent;
                  }

                  // 追加新的内容
                  const newContent = existingContent + tag.content;

                  // 构建完整内容：think + content
                  const fullContent = hasThink
                    ? `<think>${thinkContent}</think>\n\n${newContent}`
                    : newContent;

                  return {
                    ...msg,
                    content: fullContent,
                    loading: true,
                    streamStatus: "streaming",
                  };
                })
              );
            }
          },
          () => {
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
          (error) => {
            // 错误处理
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
    [isRequesting, messages, parseTextStream]
  );

  /**
   * Think 组件自定义渲染
   * 根据消息的 streamStatus 显示不同的状态
   * 展开状态使用 ref 存储，避免重新渲染时丢失
   */
  const createThinkComponent = useCallback(
    (messageId: string) => {
      // 初始化展开状态：如果不存在，则设置为 true（默认展开）
      if (!thinkExpandedRef.current.has(messageId)) {
        thinkExpandedRef.current.set(messageId, true);
      }

      // 使用 ref 存储 messageId，避免依赖警告
      const messageIdRef = { current: messageId };

      const ThinkComponentForMessage = React.memo((props: ComponentProps) => {
        const [title, setTitle] = React.useState("思考中...");
        const [loading, setLoading] = React.useState(true);
        const [expanded, setExpanded] = React.useState(() => {
          // 从 ref 中读取初始展开状态
          return thinkExpandedRef.current.get(messageIdRef.current) ?? true;
        });

        // 从 messages 状态中获取最新的 streamStatus
        const currentMessage = messages.find(
          (m) => m.id === messageIdRef.current
        );
        const streamStatus = currentMessage?.streamStatus || "done";

        React.useEffect(() => {
          // streamStatus 可能是 'done' | 'streaming' | undefined
          if (streamStatus === "done") {
            setTitle("思考完成");
            setLoading(false);
            // 完成时自动折叠（但保留用户手动展开的状态）
            const currentExpanded = thinkExpandedRef.current.get(
              messageIdRef.current
            );
            if (currentExpanded === undefined || currentExpanded === true) {
              // 只有在未手动设置过或当前为展开状态时才自动折叠
              setExpanded(false);
              thinkExpandedRef.current.set(messageIdRef.current, false);
            }
          } else if (streamStatus === "streaming") {
            setTitle("思考中...");
            setLoading(true);
          }
        }, [streamStatus]);

        const handleToggle = React.useCallback(() => {
          const newExpanded = !expanded;
          setExpanded(newExpanded);
          thinkExpandedRef.current.set(messageIdRef.current, newExpanded);
        }, [expanded]);

        return (
          <Think
            title={title}
            loading={loading}
            expanded={expanded}
            onClick={handleToggle}
          >
            {props.children}
          </Think>
        );
      });

      ThinkComponentForMessage.displayName = `ThinkComponent-${messageId}`;
      return ThinkComponentForMessage;
    },
    [messages]
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
   * 为每个消息创建稳定的 ThinkComponent 引用
   * 使用 Map 缓存，避免每次重新创建导致状态丢失
   */
  const thinkComponentCacheRef = useRef<
    Map<string, React.ComponentType<ComponentProps>>
  >(new Map());

  /**
   * 转换消息为 Bubble.List 需要的格式
   */
  const bubbleItems = useMemo(() => {
    return messages.map((msg) => {
      const isLoading = msg.loading || msg.streamStatus === "streaming";

      // 为每个消息创建稳定的 ThinkComponent 引用
      // 使用缓存避免重新创建，每个消息只创建一次
      let ThinkComponentForMessage = thinkComponentCacheRef.current.get(msg.id);
      if (!ThinkComponentForMessage) {
        ThinkComponentForMessage = createThinkComponent(msg.id);
        thinkComponentCacheRef.current.set(msg.id, ThinkComponentForMessage);
      }

      return {
        key: msg.id,
        loading: isLoading,
        role: msg.role,
        // 使用 XMarkdown 渲染助手消息，用户消息保持纯文本
        content:
          msg.role === "user" ? (
            msg.content
          ) : (
            <XMarkdown
              content={msg.content || "正在思考..."}
              components={{ think: ThinkComponentForMessage }}
              paragraphTag="div"
            />
          ),
      };
    });
  }, [messages, createThinkComponent]);

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
  }, [bubbleItems]);

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
          placeholder="输入您的问题，我会从知识库中检索相关内容并回答..."
        />
      </div>
    </div>
  );
}
