"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Collapse } from "antd";
import XMarkdown from "@ant-design/x-markdown";
import { BulbOutlined, SearchOutlined, FileTextOutlined, LoadingOutlined } from "@ant-design/icons";
import { Think } from "@ant-design/x";
import type { ReactLoop, ReactTimelineItem, StepType } from "@/types/agent-stream";

const STEP_CONFIG: Record<
  StepType,
  { icon: React.ReactNode; label: string; color: string }
> = {
  thought: { icon: <BulbOutlined />, label: "思考", color: "#faad14" },
  action: { icon: <SearchOutlined />, label: "调用", color: "#1890ff" },
  observation: { icon: <FileTextOutlined />, label: "结果", color: "#52c41a" },
};

/**
 * 样式文案配置
 */
export interface AgentStyleCopy {
  thinking?: string;
  thinkSegment?: string;
  thinkComplete?: string;
  retrievalRoundPrefix?: string;
  retrievalRoundSuffix?: string;
}

/**
 * AgentMessageContent 属性
 */
export interface AgentMessageContentProps {
  content: string;
  thoughts: string[];
  reactLoops: ReactLoop[];
  reactTimeline: ReactTimelineItem[];
  /** 当前 assistant 消息是否正在流式输出 */
  isLoading?: boolean;
  variant?: "default" | "compact" | "drawer";
  styleCopy?: AgentStyleCopy;
}

const DEFAULT_STYLE_COPY: AgentStyleCopy = {
  thinking: "正在思考…",
  thinkSegment: "思考过程",
  thinkComplete: "思考完成",
  retrievalRoundPrefix: "检索 #",
  retrievalRoundSuffix: "",
};

/**
 * Drawer 变体子组件 — 无 Hooks，纯展示
 */
function DrawerVariant({ content }: { content: string }) {
  if (!content) return null;
  return (
    <div className="whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-200">
      {content}
    </div>
  );
}

/**
 * 单个 ReAct 步骤渲染（含详细元数据）
 */
const ReactStepItem: React.FC<{
  step: ReactLoop["steps"][number];
  variant: string;
}> = React.memo(({ step, variant }) => {
  const config = STEP_CONFIG[step.type];
  if (!step.content && !step.toolName) return null;

  const isCompact = variant === "compact" || variant === "drawer";

  const durationText = step.durationMs != null
    ? (step.durationMs < 1000 ? `${step.durationMs}ms` : `${(step.durationMs / 1000).toFixed(1)}s`)
    : null;

  const timeRangeText = (() => {
    if (!step.startedAt) return null;
    const start = new Date(step.startedAt).toLocaleTimeString("zh-CN", { hour12: false });
    if (step.endedAt) {
      const end = new Date(step.endedAt).toLocaleTimeString("zh-CN", { hour12: false });
      return `${start} → ${end}`;
    }
    return `${start} 开始`;
  })();

  return (
    <div
      className={
        isCompact
          ? "flex items-start gap-1.5 text-xs leading-relaxed"
          : "flex items-start gap-2 text-sm leading-relaxed"
      }
    >
      <span
        className="shrink-0"
        style={{ color: config.color, marginTop: isCompact ? 1 : 2 }}
      >
        {config.icon}
      </span>
      <span
        className={
          isCompact
            ? "shrink-0 font-medium text-gray-400 dark:text-slate-400"
            : "shrink-0 font-medium text-gray-500 dark:text-slate-300"
        }
      >
        {config.label}
      </span>
      <span className="flex-1 min-w-0">
        <span
          className={
            isCompact
              ? "text-gray-600 dark:text-slate-300"
              : "text-gray-700 dark:text-slate-200"
          }
        >
          {step.toolName && (
            <span className="font-mono font-medium text-blue-600 dark:text-blue-400">
              {step.toolName}
            </span>
          )}
          {step.toolName && step.content && (
            <span className="text-gray-400 mx-1">·</span>
          )}
          {step.content}
          {step.isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-gray-400 ml-0.5 animate-pulse align-middle dark:bg-slate-300" />
          )}
        </span>
        {(timeRangeText || durationText) && !step.isStreaming && (
          <span className="ml-1 text-gray-300 dark:text-slate-500">
            {timeRangeText}
            {durationText && <span className="ml-1">({durationText})</span>}
          </span>
        )}
      </span>
    </div>
  );
});
ReactStepItem.displayName = "ReactStepItem";

/**
 * Default/Compact 变体子组件 — 包含所有 Hooks
 */
function TimelineVariant({
  content,
  thoughts,
  reactLoops,
  reactTimeline,
  isLoading,
  variant,
  styleCopy,
}: {
  content: string;
  thoughts: string[];
  reactLoops: ReactLoop[];
  reactTimeline: ReactTimelineItem[];
  isLoading: boolean;
  variant: "default" | "compact";
  styleCopy: AgentStyleCopy;
}) {
  const copy = styleCopy;
  const isCompact = variant === "compact";

  const [expandedThinkMap, setExpandedThinkMap] = useState<Record<number, boolean>>({});

  const renderLoop = useCallback(
    (loop: ReactTimelineItem & { type: "loop" }) => {
      const collapseItems = [
        {
          key: `loop-${loop.index}`,
          label: (
            <span
              className={
                isCompact
                  ? "flex items-center gap-1.5 text-xs"
                  : "flex items-center gap-2"
              }
            >
              <span>
                {copy.retrievalRoundPrefix}
                {loop.index}
                {copy.retrievalRoundSuffix}
              </span>
              {loop.steps.some((s) => s.isStreaming) && <LoadingOutlined />}
            </span>
          ),
          children: (
            <div className={isCompact ? "space-y-1" : "space-y-2"}>
              {loop.steps.map((step, stepIdx) => (
                <ReactStepItem key={`${loop.index}-${stepIdx}`} step={step} variant={variant} />
              ))}
            </div>
          ),
        },
      ];

      return (
        <Collapse
          key={`timeline-loop-${loop.index}`}
          size="small"
          defaultActiveKey={[`loop-${loop.index}`]}
          className={isCompact ? "chat-react-loop-compact mb-2" : "chat-react-loop mb-3"}
          items={collapseItems}
        />
      );
    },
    [copy.retrievalRoundPrefix, copy.retrievalRoundSuffix, isCompact, variant],
  );

  // 构建 timeline（优先使用 reactTimeline，fallback 到 thoughts + reactLoops）
  // 注意：reactTimeline 已包含工具调用（tool_start/tool_end 融合为 loop 条目），
  // 因此工具调用会按 SSE 时间顺序与思考穿插展示。
  const orderedTimeline = useMemo(() => {
    if (reactTimeline.length > 0) return reactTimeline;
    const timeline: ReactTimelineItem[] = [];
    for (const thought of thoughts) {
      timeline.push({ type: "think", content: thought, isStreaming: false });
    }
    for (const loop of reactLoops) {
      timeline.push({ type: "loop", index: loop.index, steps: loop.steps });
    }
    return timeline;
  }, [reactLoops, reactTimeline, thoughts]);

  // 判断 assistant 消息是否正在加载中
  const hasStreamingContent = isLoading || (orderedTimeline.some(
    (item) => item.type === "think" && item.isStreaming,
  ) || orderedTimeline.some(
    (item) => item.type === "loop" && item.steps.some((s) => s.isStreaming),
  ));

  const effectiveTimeline = orderedTimeline;

  return (
    <div>
      {!hasStreamingContent && !content ? (
        <div className="flex items-center gap-2 text-gray-400 dark:text-slate-300">
          <LoadingOutlined spin />
          <span>{copy.thinking}</span>
        </div>
      ) : (
        <>
          {effectiveTimeline.map((item, index) => {
            if (item.type === "think") {
              const isLatestThink = index === effectiveTimeline.length - 1;
              const defaultExpanded = hasStreamingContent && isLatestThink;
              const isExpanded = expandedThinkMap[index] ?? defaultExpanded;

              return (
                <Think
                  key={`timeline-think-${index}`}
                  rootClassName={isCompact ? "chat-think-compact" : "chat-think"}
                  classNames={{
                    status: isCompact ? "chat-think-status-compact" : "chat-think-status",
                    content: isCompact ? "chat-think-content-compact" : "chat-think-content",
                  }}
                  title={hasStreamingContent && isLatestThink ? copy.thinking : copy.thinkSegment}
                  loading={hasStreamingContent && isLatestThink}
                  expanded={isExpanded}
                  onClick={() => {
                    setExpandedThinkMap((prev) => ({
                      ...prev,
                      [index]: !(prev[index] ?? defaultExpanded),
                    }));
                  }}
                >
                  {item.content}
                </Think>
              );
            }

            return renderLoop(item);
          })}

          {content && (
            <XMarkdown className={isCompact ? "x-markdown-compact" : undefined}>
              {content}
            </XMarkdown>
          )}
        </>
      )}
    </div>
  );
}

/**
 * AgentMessageContent — 通用 Agent 消息渲染组件
 *
 * 三种变体：
 * - default: /chat 页面完整样式（Think + Collapse + XMarkdown）
 * - compact: 内容中台 Drawer 内嵌样式（紧凑间距）
 * - drawer: 最简模式（仅内容展示）
 */
export const AgentMessageContent = React.memo<AgentMessageContentProps>(
  ({ content, thoughts, reactLoops, reactTimeline, isLoading = false, variant = "default", styleCopy = {} }) => {
    if (variant === "drawer") {
      return <DrawerVariant content={content} />;
    }

    return (
      <TimelineVariant
        content={content}
        thoughts={thoughts}
        reactLoops={reactLoops}
        reactTimeline={reactTimeline}
        isLoading={isLoading}
        variant={variant}
        styleCopy={{ ...DEFAULT_STYLE_COPY, ...styleCopy }}
      />
    );
  },
);
AgentMessageContent.displayName = "AgentMessageContent";
