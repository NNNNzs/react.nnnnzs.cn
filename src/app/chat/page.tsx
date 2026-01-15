"use client";

/**
 * 聊天页面
 * 使用 Ant Design X 组件实现知识库检索对话
 * 支持 ReAct Agent 和 SSE 流式响应
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
  ToolOutlined,
  EyeOutlined 
} from "@ant-design/icons";
import { Bubble, Sender } from "@ant-design/x";
import XMarkdown from "@ant-design/x-markdown";
import { Typography, Button, message as antdMessage, Collapse } from "antd";
import { parseSSEStream } from "@/lib/sse";

const { Title, Text } = Typography;

/**
 * 工具调用信息
 */
interface ToolCall {
  method: string;
  params: Record<string, unknown>;
  id: string | number;
}

/**
 * 工具结果信息
 */
interface ToolResult {
  jsonrpc: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
  id: string | number;
}

/**
 * ReAct 步骤
 */
interface ReactStep {
  type: 'thought' | 'action' | 'observation';
  content: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
}

/**
 * 消息类型定义
 */
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reactSteps?: ReactStep[]; // ReAct 步骤
  loading?: boolean;
  streamStatus?: "streaming" | "done";
}

/**
 * MessageContent 组件属性
 */
interface MessageContentProps {
  content: string;
  reactSteps?: ReactStep[];
  streamStatus?: "streaming" | "done";
}

/**
 * MessageContent 组件
 * 展示 ReAct 步骤和最终答案
 */
const MessageContent: React.FC<MessageContentProps> = ({
  content,
  reactSteps = [],
  streamStatus,
}) => {
  const isLoading = streamStatus === "streaming";

  // 如果没有内容且正在加载，显示加载提示
  if (isLoading && !content && reactSteps.length === 0) {
    return <div>正在思考...</div>;
  }

  return (
    <div className="space-y-4">
      {/* ReAct 步骤 */}
      {reactSteps.length > 0 && (
        <Collapse
          defaultActiveKey={isLoading ? ["steps"] : []}
          className="react-steps-collapse"
          size="small"
          items={[
            {
              key: "steps",
              label: (
                <Text type="secondary">
                  🔍 思考过程 ({reactSteps.length} 步)
                </Text>
              ),
              children: (
                <div className="space-y-3">
                  {reactSteps.map((step, index) => (
                    <div key={index} className="react-step">
                      {step.type === "thought" && (
                        <div className="bg-blue-50 p-3 rounded">
                          <Text
                            type="secondary"
                            className="text-xs block mb-1"
                          >
                            💭 思考
                          </Text>
                          <XMarkdown>{step.content}</XMarkdown>
                        </div>
                      )}
                      {step.type === "action" && step.toolCall && (
                        <div className="bg-green-50 p-3 rounded">
                          <Text
                            type="secondary"
                            className="text-xs block mb-1"
                          >
                            <ToolOutlined /> 工具调用
                          </Text>
                          <div className="text-sm">
                            <strong>方法：</strong> {step.toolCall.method}
                          </div>
                          <div className="text-sm mt-1">
                            <strong>参数：</strong>
                            <pre className="mt-1 text-xs bg-white p-2 rounded overflow-x-auto">
                              {JSON.stringify(step.toolCall.params, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                      {step.type === "observation" && step.toolResult && (
                        <div className="bg-yellow-50 p-3 rounded">
                          <Text
                            type="secondary"
                            className="text-xs block mb-1"
                          >
                            <EyeOutlined /> 观察结果
                          </Text>
                          <pre className="text-xs bg-white p-2 rounded overflow-x-auto max-h-40">
                            {JSON.stringify(step.toolResult, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ),
            },
          ]}
        />
      )}

      {/* 最终答案 */}
      {content && (
        <div>
          {reactSteps.length > 0 && (
            <Text type="secondary" className="text-xs block mb-2">
              ✅ 最终答案
            </Text>
          )}
          <XMarkdown>{content}</XMarkdown>
        </div>
      )}
    </div>
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
        reactSteps: [],
        loading: true,
        streamStatus: "streaming",
      };

      setMessages((prev) => [...prev, userMessage, aiMessage]);
      setIsRequesting(true);
      setContent("");

      try {
        // 构建历史记录
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

        // 发起 SSE 请求
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

        // 当前思考内容缓冲区（按轮次维护）
        let currentThoughtBuffer = '';
        
        // 解析 SSE 流
        await parseSSEStream(response, {
          onThought: (data) => {
            // 累积当前轮的思考内容
            currentThoughtBuffer += data;
            console.log(
              "💭 onThought 累积长度:",
              currentThoughtBuffer.length,
              "新增:",
              data.length
            );

            // 普通异步更新，避免 flushSync 嵌套导致最大更新深度错误
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;

                // 更新或添加思考步骤
                const steps = [...(msg.reactSteps || [])];
                const lastStep = steps[steps.length - 1];

                if (lastStep && lastStep.type === "thought") {
                  // 更新最后一个思考步骤
                  lastStep.content = currentThoughtBuffer;
                } else {
                  // 添加新的思考步骤
                  steps.push({
                    type: "thought",
                    content: currentThoughtBuffer,
                  });
                }

                return {
                  ...msg,
                  reactSteps: steps,
                  loading: true,
                  streamStatus: "streaming",
                };
              })
            );
          },

          onAction: (data) => {
            // 开始新的思考轮次（不清空，保留上一轮的思考）
            // 下一轮 onThought 会创建新的思考步骤
            
            // 添加工具调用步骤
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;

                const steps = [...(msg.reactSteps || [])];
                steps.push({
                  type: "action",
                  content: "",
                  toolCall: data as ToolCall,
                });

                return {
                  ...msg,
                  reactSteps: steps,
                };
              })
            );
            
            // 重置当前轮的思考缓冲区，准备下一轮
            currentThoughtBuffer = '';
          },

          onObservation: (data) => {
            // 添加观察步骤
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;

                const steps = [...(msg.reactSteps || [])];
                steps.push({
                  type: "observation",
                  content: "",
                  toolResult: data as ToolResult,
                });

                return {
                  ...msg,
                  reactSteps: steps,
                };
              })
            );
          },

          onAnswer: (data) => {
            // 设置最终答案
            // 优先使用 data，如果为空则使用当前轮的思考内容
            let finalAnswer = data || currentThoughtBuffer;
            
            // 如果还是为空，尝试从 reactSteps 中获取最后一个思考步骤的内容
            if (!finalAnswer || !finalAnswer.trim()) {
              setMessages((prev) => {
                const msg = prev.find(m => m.id === aiMessageId);
                if (msg?.reactSteps) {
                  const lastThought = [...msg.reactSteps].reverse().find(s => s.type === 'thought');
                  if (lastThought?.content) {
                    finalAnswer = lastThought.content;
                  }
                }
                return prev;
              });
            }
            
            console.log('📌 onAnswer 接收:', {
              data: data?.substring(0, 100),
              currentThoughtBuffer: currentThoughtBuffer?.substring(0, 100),
              finalAnswer: finalAnswer?.substring(0, 100),
            });
            
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId
                  ? {
                      ...msg,
                      content: finalAnswer || '(无响应)',
                      loading: false,
                      streamStatus: "done",
                    }
                  : msg
              )
            );
            setIsRequesting(false);
          },

          onError: (data) => {
            // 错误处理
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId
                  ? {
                      ...msg,
                      content: `错误：${data.message}`,
                      loading: false,
                      streamStatus: "done",
                    }
                  : msg
              )
            );
            setIsRequesting(false);
            antdMessage.error(data.message);
          },

          onDone: () => {
            // 完成
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== aiMessageId) return msg;
                
                // 如果没有内容，尝试从多个来源获取
                let finalContent = msg.content || currentThoughtBuffer;
                
                // 如果还是为空，从 reactSteps 中获取最后一个思考步骤
                if (!finalContent || !finalContent.trim()) {
                  if (msg.reactSteps) {
                    const lastThought = [...msg.reactSteps].reverse().find(s => s.type === 'thought');
                    if (lastThought?.content) {
                      finalContent = lastThought.content;
                    }
                  }
                }
                
                return {
                  ...msg,
                  content: finalContent || '(无响应)',
                  loading: false,
                  streamStatus: "done",
                };
              })
            );
            setIsRequesting(false);
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
   * 不使用 useMemo，确保每次 messages 更新时都重新计算，实现流式渲染
   */
  const bubbleItems = messages.map((msg) => {
    return {
      key: msg.id,
      role: msg.role,
      content:
        msg.role === "user" ? (
          msg.content
        ) : (
          <MessageContent
            content={msg.content}
            reactSteps={msg.reactSteps}
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
          messageContainerRef.current.scrollTop =
            messageContainerRef.current.scrollHeight;
        }
      });
    }
  }, [messages, isRequesting]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl h-[calc(100vh-var(--header-height))] flex flex-col overflow-hidden">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Title level={2} style={{ marginBottom: 16 }}>
            💬 网站百事通
          </Title>
          <Typography.Text type="secondary" className="block">
            基于网站知识库，检索相关文章，回答您的问题，你可以询问作者公开的信息
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
          placeholder="输入您的问题，我会从知识库中检索相关内容并回答...例如作者去过哪些地方旅游"
        />
      </div>
    </div>
  );
}
