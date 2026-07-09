/**
 * Agent 流式通信协议 — 共享类型定义
 *
 * 统一 /chat（知识问答）和 /create（创作助手）两个 Agent 系统的
 * 消息结构、SSE 事件类型、ReAct Timeline 类型和业务 patch 类型。
 *
 * @module agent-stream
 */

// ============================================================
// 1. Agent 消息 & Tool Call
// ============================================================

/**
 * Agent 消息（前端消息列表中的单条消息）
 *
 * 两个页面共享此结构：
 * - /chat 页面：role 为 user 或 assistant，assistant 消息带 thoughts/reactLoops/reactTimeline
 * - /create 页面：role 为 user 或 assistant，assistant 消息带 tools/hasPatch
 */
export interface AgentMessage {
  /** 消息唯一 ID */
  id: string;
  /** 角色 */
  role: 'user' | 'assistant';
  /** 正文内容（流式累积） */
  content: string;
  /** 思考段落列表（think 标签内容），默认 [] */
  thoughts?: string[];
  /** ReAct 循环列表，默认 [] */
  reactLoops?: ReactLoop[];
  /** Timeline 条目（优先于 thoughts + reactLoops），默认 [] */
  reactTimeline?: ReactTimelineItem[];
  /** 是否正在加载（流式输出中） */
  loading?: boolean;
  /**
   * Tool Call 列表
   * - /chat 页面用于渲染 ReAct Timeline
   * - /create 页面用于渲染 ToolCallTag
   */
  tools: AgentToolCall[];
  /**
   * 标记收到过业务 patch，便于 UI 提示用户确认
   * 仅 /create 页面使用
   */
  hasPatch?: boolean;
}

/**
 * 单条 Tool Call
 */
export interface AgentToolCall {
  /** 轮次序号（从 1 开始） */
  step: number;
  /** 工具名称 */
  tool: string;
  /** 调用参数（可选，用于前端展示） */
  args?: unknown;
  /** 执行结果（可选，tool_end 时填充） */
  result?: string;
  /** 状态 */
  status: 'running' | 'done';
}

// ============================================================
// 2. SSE 事件帧类型
// ============================================================

/**
 * 服务端发送的 SSE 事件统一类型
 *
 * 协议：Content-Type: text/event-stream
 * 编码：src/lib/sse.ts → encodeSSE()
 * 解析：src/lib/sse.ts → parseSSEStream() + parseSSEData()
 */
export type SSEClientEvent =
  | { event: 'meta'; data: { scenario: string; sessionId?: number } }
  | { event: 'token'; data: { content: string } }
  | {
      event: 'tool_start';
      data: {
        tool: string;
        args?: unknown;
        step: number;
        runId: string;
        startedAt?: string;
      };
    }
  | {
      event: 'tool_end';
      data: {
        tool: string;
        result?: string;
        step: number;
        runId: string;
        endedAt?: string;
        durationMs?: number;
      };
    }
  | { event: 'think_start'; data: Record<string, never> }
  | { event: 'think_chunk'; data: { content: string } }
  | { event: 'think_end'; data: Record<string, never> }
  | { event: 'content_chunk'; data: { content: string } }
  | { event: 'patch'; data: Record<string, unknown> }
  | { event: 'done'; data: Record<string, never> }
  | { event: 'error'; data: { message: string } };

// ============================================================
// 3. ReAct Timeline 类型（存储 & 渲染用）
// ============================================================

/**
 * Step 子类型
 *
 * - thought: 模型推理 / 思考过程（流式）
 * - action: 工具调用（一次性）
 * - observation: 工具返回结果（一次性）
 */
export type StepType = 'thought' | 'action' | 'observation';

/**
 * 单个 ReAct 步骤
 */
export interface ReactStep {
  type: StepType;
  content: string;
  /** 工具名称（action / observation 常用） */
  toolName?: string;
  /** 工具开始时间（ISO 字符串） */
  startedAt?: string;
  /** 工具结束时间（ISO 字符串） */
  endedAt?: string;
  /** 工具耗时（毫秒） */
  durationMs?: number;
  /** 是否正在流式输出（前端渲染用） */
  isStreaming?: boolean;
}

/**
 * 一轮 ReAct 循环（thought + action + observation）
 */
export interface ReactLoop {
  /** 轮次索引（从 1 开始） */
  index: number;
  /** 该轮包含的步骤 */
  steps: ReactStep[];
}

/**
 * Timeline 中的 think 段落
 */
export interface ReactTimelineThinkItem {
  type: 'think';
  content: string;
  /** 是否正在流式输出 */
  isStreaming?: boolean;
}

/**
 * Timeline 中的 ReAct 循环段落
 */
export interface ReactTimelineLoopItem {
  type: 'loop';
  /** 轮次索引 */
  index: number;
  /** 该轮步骤列表 */
  steps: ReactStep[];
}

/**
 * Timeline 条目联合类型
 */
export type ReactTimelineItem = ReactTimelineThinkItem | ReactTimelineLoopItem;

// ============================================================
// 4. Draft Patch 类型（内容中台业务数据）
// ============================================================

/**
 * 草稿图片
 */
export interface DraftPatchImage {
  /** 已入库的素材 ID */
  assetId?: number;
  /** 图片 CDN URL */
  imageUrl: string;
  /** 图片备注/标题 */
  title?: string;
  /** 分组名，如 cover */
  group?: string;
}

/**
 * 草稿 Patch
 *
 * 由创作助手的 emit_draft_patch 工具产出，通过 SSE patch 事件下发。
 * 前端先展示差异并等待用户确认，再应用到草稿表单 state。
 */
export interface DraftPatch {
  /** 新标题 */
  title?: string;
  /** 钩子文案 */
  hook?: string;
  /** 正文（Markdown） */
  body?: string;
  /** 标签数组 */
  tags?: string[];
  /** 草稿状态 */
  status?: 'DRAFT' | 'ASSET_PENDING' | 'READY' | 'PUBLISHED' | 'ARCHIVED';
  /** 要追加到草稿的图片 */
  addImages?: DraftPatchImage[];
}

// ============================================================
// 5. 后端存储用类型（与数据库 metadata 字段兼容）
// ============================================================

/**
 * 存储到数据库的 ReAct 步骤（不含前端专用字段 isStreaming）
 */
export type StoredReactStep = Omit<ReactStep, 'isStreaming'> & {
  /** 轮次索引（冗余存储，便于查询） */
  index: number;
};

/**
 * 存储到数据库的 Timeline 条目
 */
export type StoredReactTimelineItem =
  | {
      type: 'think';
      content: string;
    }
  | {
      type: 'loop';
      index: number;
      steps: StoredReactStep[];
    };
