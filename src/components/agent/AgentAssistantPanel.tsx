"use client";

import React, { useRef, useState } from "react";
import { Button, Drawer, Input, Tag } from "antd";
import { SendOutlined, StopOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { AgentMessageContent } from "@/components/agent/AgentMessageContent";
import type { AgentStyleCopy } from "@/components/agent/AgentMessageContent";
import { useExternalLinks } from "@/hooks/useExternalLinks";
import { useSmartAutoScroll } from "@/hooks/useSmartAutoScroll";
import type { AgentMessage } from "@/types/agent-stream";

export interface AgentAssistantQuickPrompt {
  label: string;
  value?: string;
}

export interface AgentAssistantPanelProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  messages: AgentMessage[];
  isStreaming: boolean;
  onSend: (text: string) => void;
  onAbort: () => void;
  quickPrompts?: AgentAssistantQuickPrompt[];
  emptyDescription?: React.ReactNode;
  patchNotice?: React.ReactNode;
  patchActionLabel?: string;
  onPatchAction?: () => void;
  placeholder?: string;
  width?: number | string;
  styleCopy?: AgentStyleCopy;
  markdownClassName?: string;
}

export function AgentAssistantPanel({
  open,
  onClose,
  title,
  messages,
  isStreaming,
  onSend,
  onAbort,
  quickPrompts = [],
  emptyDescription,
  patchNotice,
  patchActionLabel,
  onPatchAction,
  placeholder = "对助手说点什么...",
  width = 420,
  styleCopy,
  markdownClassName,
}: AgentAssistantPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { onScroll } = useSmartAutoScroll(scrollRef, isStreaming, [messages]);
  useExternalLinks(scrollRef, [messages]);

  const handleSend = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || isStreaming) return;
    onSend(value);
    setInput("");
  };

  return (
    <Drawer
      title={title}
      placement="right"
      open={open}
      onClose={onClose}
      width={width}
      mask={false}
      styles={{ body: { padding: 0, display: "flex", flexDirection: "column", height: "100%" } }}
    >
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 ? (
          <AgentAssistantEmptyState
            description={emptyDescription}
            quickPrompts={quickPrompts}
            onSend={handleSend}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <AgentAssistantMessageBubble
                key={message.id}
                message={message}
                patchNotice={patchNotice}
                patchActionLabel={patchActionLabel}
                onPatchAction={onPatchAction}
                styleCopy={styleCopy}
                markdownClassName={markdownClassName}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-3" style={{ flexShrink: 0 }}>
        <div className="flex gap-2">
          <Input.TextArea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={placeholder}
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(event) => {
              if (!event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button danger icon={<StopOutlined />} onClick={onAbort} />
          ) : (
            <Button type="primary" icon={<SendOutlined />} onClick={() => handleSend()} />
          )}
        </div>
      </div>
    </Drawer>
  );
}

interface AgentAssistantEmptyStateProps {
  description?: React.ReactNode;
  quickPrompts: AgentAssistantQuickPrompt[];
  onSend: (text: string) => void;
}

function AgentAssistantEmptyState({
  description,
  quickPrompts,
  onSend,
}: AgentAssistantEmptyStateProps) {
  if (!description && quickPrompts.length === 0) return null;

  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
      {description}
      {quickPrompts.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {quickPrompts.map((prompt) => {
            const value = prompt.value ?? prompt.label;
            return (
              <Button
                key={value}
                size="small"
                className="!h-auto !whitespace-normal !text-left"
                onClick={() => onSend(value)}
              >
                <ThunderboltOutlined /> {prompt.label}
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

interface AgentAssistantMessageBubbleProps {
  message: AgentMessage;
  patchNotice?: React.ReactNode;
  patchActionLabel?: string;
  onPatchAction?: () => void;
  styleCopy?: AgentStyleCopy;
  markdownClassName?: string;
}

const AgentAssistantMessageBubble = React.memo(function AgentAssistantMessageBubble({
  message,
  patchNotice,
  patchActionLabel,
  onPatchAction,
  styleCopy,
  markdownClassName,
}: AgentAssistantMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "whitespace-pre-wrap break-words bg-blue-500 text-white"
            : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
        }`}
      >
        {isUser ? (
          message.content
        ) : (
          <AgentMessageContent
            content={message.content}
            thoughts={message.thoughts || []}
            reactLoops={message.reactLoops || []}
            reactTimeline={message.reactTimeline || []}
            isLoading={Boolean(message.loading)}
            variant="compact"
            styleCopy={styleCopy}
            markdownClassName={markdownClassName}
          />
        )}
      </div>

      {!isUser && message.hasPatch && (patchNotice || patchActionLabel) ? (
        <div className="flex flex-wrap items-center gap-1.5 self-start">
          {patchNotice ? (
            <Tag color="orange" className="!mr-0 !text-xs">
              {patchNotice}
            </Tag>
          ) : null}
          {patchActionLabel && onPatchAction ? (
            <Button size="small" type="link" className="!h-auto !px-0 !text-xs" onClick={onPatchAction}>
              {patchActionLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
