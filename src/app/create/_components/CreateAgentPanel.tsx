"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button, Drawer, Input, Tag, Tooltip } from "antd";
import { SendOutlined, StopOutlined, ThunderboltOutlined } from "@ant-design/icons";
import type { AgentMessage } from "./useCreateAgent";

interface CreateAgentPanelProps {
  open: boolean;
  onClose: () => void;
  messages: AgentMessage[];
  isStreaming: boolean;
  onSend: (text: string) => void;
  onAbort: () => void;
}

const QUICK_PROMPTS = [
  "基于正文写 3 条小红书标题，填到 hook",
  "为第一张图卡生成配图",
  "把这篇草稿扩展成 3 张图卡的图文",
];

export function CreateAgentPanel({
  open,
  onClose,
  messages,
  isStreaming,
  onSend,
  onAbort,
}: CreateAgentPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新消息时滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || isStreaming) return;
    onSend(value);
    setInput("");
  };

  return (
    <Drawer
      title="✨ 创作助手"
      placement="right"
      open={open}
      onClose={onClose}
      width={420}
      mask={false}
      styles={{ body: { padding: 0, display: "flex", flexDirection: "column", height: "100%" } }}
    >
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            告诉我你想做什么：改标题、写文案、生成配图。修改会填入表单，记得点保存。
            <div className="mt-3 flex flex-col gap-2">
              {QUICK_PROMPTS.map((p) => (
                <Button
                  key={p}
                  size="small"
                  className="!text-left"
                  onClick={() => handleSend(p)}
                >
                  <ThunderboltOutlined /> {p}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-3" style={{ flexShrink: 0 }}>
        <div className="flex gap-2">
          <Input.TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="对助手说点什么…"
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Tooltip title="停止">
              <Button danger icon={<StopOutlined />} onClick={onAbort} />
            </Tooltip>
          ) : (
            <Button type="primary" icon={<SendOutlined />} onClick={() => handleSend()} />
          )}
        </div>
      </div>
    </Drawer>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-blue-500 text-white"
            : "bg-slate-100 text-slate-800"
        }`}
      >
        {message.content || (isUser ? "" : "…")}
      </div>

      {!isUser && message.tools.length > 0 && (
        <div className="flex w-full flex-col gap-1">
          {message.tools.map((tool) => (
            <ToolCallTag key={tool.step} tool={tool} />
          ))}
        </div>
      )}

      {!isUser && message.hasPatch && (
        <Tag color="orange" className="!text-xs">
          已填入表单，记得点保存
        </Tag>
      )}
    </div>
  );
}

function ToolCallTag({ tool }: { tool: AgentMessage["tools"][number] }) {
  const isRunning = tool.status === "running";
  return (
    <Tag
      color={isRunning ? "processing" : "default"}
      className="!max-w-full !text-xs !whitespace-normal"
    >
      {isRunning ? "⚙️ 调用" : "✓"}{" "}
      <span className="font-mono">{tool.tool}</span>
      {tool.result ? (
        <span className="text-slate-400"> → {truncate(tool.result, 80)}</span>
      ) : null}
    </Tag>
  );
}

function truncate(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}
