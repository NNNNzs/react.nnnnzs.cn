# 聊天系统迁移计划：从手写 ReAct 到 LangChain 全家桶

## 概述

**目标**：将当前手写的 ReAct Agent 聊天系统完全迁移至 LangChain 技术栈，包括 LangGraph Agent、LangChain Tools、LangChain RAG，同时保留前端 ReAct 步骤可视化。

**状态**：计划中
**创建日期**：2026-04-28

---

## 当前架构分析

### 代码资产清单

| 文件 | 职责 | 行数 | 改造动作 |
|------|------|------|---------|
| `src/lib/react-agent.ts` | 手写 ReAct 循环 + JSON-RPC 解析 | ~370 | **删除** → 替换为 LangGraph |
| `src/services/ai/tools/index.ts` | 自定义 ToolRegistry + JSON-RPC 协议 | ~290 | **重写** → LangChain StructuredTool |
| `src/services/ai/tools/search-articles.ts` | 向量搜索工具 | ~180 | **改造** → 转为 LangChain Tool |
| `src/services/ai/tools/search-posts-meta.ts` | 元数据搜索工具 | ~150 | **改造** → 转为 LangChain Tool |
| `src/services/ai/tools/search-collection.ts` | 合集搜索工具 | ~95 | **改造** → 转为 LangChain Tool |
| `src/services/ai/rag/agent.ts` | RAG Agent 编排 + 流式标签 | ~330 | **重写** → LangGraph Agent 编排 |
| `src/lib/stream-tags.ts` | 自定义 XML 标签生成/解析 | ~280 | **重写** → 适配 LangGraph stream events |
| `src/lib/stream.ts` | 流式响应工具 | ~50 | **保留** + 适配 |
| `src/lib/ai.ts` | OpenAI LangChain 抽象层 | ~230 | **保留** + 扩展 |
| `src/app/api/chat/route.ts` | 聊天 API 路由 | ~90 | **微调** |
| `src/app/chat/page.tsx` | 前端聊天页面 | ~600 | **中等改造** → 适配新流式协议 |
| **合计** | | **~2665** | |

### 当前核心问题

1. **手写 JSON-RPC 解析**：用正则从文本中提取 ` ```json-rpc ``` ` 代码块，脆弱且不优雅
2. **手写 ReAct 循环**：370 行的 Thought-Action-Observation 循环，LangGraph 内置
3. **手写响应清理**：`cleanResponse()` / `extractContent()` 处理各种 LangChain chunk 格式，原生 tool calling 不需要
4. **自定义 XML 流式协议**：`StreamTagGenerator` + `StreamTagParser` 280 行，需要适配 LangGraph 的 stream events
5. **工具注册表非标准**：自定义 `ToolRegistry` + `parseToolCalls`，LangChain 有原生 `DynamicTool` / `StructuredTool`

### 模型能力确认

GLM-4.7 **原生支持 Function Calling**，无需再通过 JSON-RPC 代码块模拟工具调用。

---

## 目标架构

### 技术栈

```
LangGraph (@langchain/langgraph)  → Agent 编排（createReactAgent）
LangChain Core (@langchain/core)  → Tools、Messages、Prompt
LangChain OpenAI (@langchain/openai) → ChatOpenAI 模型接入
```

### 数据流

```
用户消息
  ↓
POST /api/chat
  ↓
LangGraph Agent (createReactAgent)
  ├─ System Prompt（标签/合集/用户信息）
  ├─ Tools（search_articles / search_posts_meta / search_collection）
  └─ Agent Loop（自动 Thought-Action-Observation）
       ↓
  LangGraph streamEvents
  ├─ on_chat_model_stream → 思考内容流式输出
  ├─ on_tool_start → 工具调用信息
  ├─ on_tool_end → 工具执行结果
  └─ 最终 answer 流式输出
       ↓
  自定义 SSE 协议（简化版 XML 标签）
       ↓
  前端 StreamTagParser 解析 → ReAct 步骤可视化
```

---

## 文件变更计划

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/services/ai/rag/langgraph-agent.ts` | LangGraph Agent 核心定义（替代 `react-agent.ts`） |

### 删除文件

| 文件 | 原因 |
|------|------|
| `src/lib/react-agent.ts` | 被 LangGraph `createReactAgent` 替代 |

### 重写文件

| 文件 | 变更范围 |
|------|---------|
| `src/services/ai/tools/index.ts` | 删除 ToolRegistry / parseToolCalls / JSON-RPC 相关，改为导出 LangChain Tool 数组 |
| `src/services/ai/rag/agent.ts` | 用 LangGraph Agent 替换手写 ReAct 循环，重写 `chatRAGAgentStream` |
| `src/lib/stream-tags.ts` | 保留标签协议，重写生成逻辑以适配 LangGraph stream events |

### 改造文件

| 文件 | 变更范围 |
|------|---------|
| `src/services/ai/tools/search-articles.ts` | Tool 接口从自定义 → LangChain `StructuredTool` |
| `src/services/ai/tools/search-posts-meta.ts` | 同上 |
| `src/services/ai/tools/search-collection.ts` | 同上 |
| `src/app/api/chat/route.ts` | 调用方式微调 |
| `src/app/chat/page.tsx` | 适配新流式协议（中等改动） |

### 保留不变

| 文件 | 原因 |
|------|------|
| `src/lib/ai.ts` | `createOpenAIModel` 基础设施不变 |
| `src/lib/ai-config.ts` | 数据库配置读取不变 |
| `src/services/embedding/*` | 向量搜索逻辑不变 |
| `src/lib/stream.ts` | 流式基础工具保留 |

---

## 分阶段实施计划

### 阶段 1：LangChain Tools 改造（预计 0.5 天）

**目标**：将 3 个工具从自定义格式转为 LangChain StructuredTool

**任务**：

1. **改造 `src/services/ai/tools/search-articles.ts`**
   - 将自定义 `Tool` 接口改为 `DynamicTool` / `StructuredTool`
   - 使用 `zod` 定义参数 schema（取代手写 parameters 对象）
   - `execute` 函数签名保持不变，返回值适配 LangChain 格式

2. **改造 `src/services/ai/tools/search-posts-meta.ts`** 和 `search-collection.ts`
   - 同上

3. **重写 `src/services/ai/tools/index.ts`**
   - 删除：`ToolRegistry` 类、`parseToolCalls`、`executeToolCall`、`formatJsonRpcResponse`、JSON-RPC 类型
   - 新增：导出 `chatTools: DynamicTool[]` 数组
   - 新增：导出 `getToolDescriptions()` 用于系统提示词（从 Tool 定义自动提取）

**验证**：TypeScript 编译通过，工具可独立调用测试

---

### 阶段 2：LangGraph Agent 核心（预计 1 天）

**目标**：用 LangGraph `createReactAgent` 替换手写 ReAct 循环

**任务**：

1. **创建 `src/services/ai/rag/langgraph-agent.ts`**
   - 使用 `createReactAgent` from `@langchain/langgraph/prebuilt`
   - 绑定 `chatTools` 到模型
   - 配置 `maxIterations: 5`

2. **重写 `src/services/ai/rag/agent.ts`**
   - `buildRAGAgentSystemPrompt`：保留（提示词逻辑不变，移除 JSON-RPC 工具格式说明）
   - `chatRAGAgentStream`：重写为使用 LangGraph Agent
   - 使用 `agent.streamEvents()` 获取流式事件
   - 事件映射：
     - `on_chat_model_stream` → 思考内容
     - `on_tool_start` → 工具调用
     - `on_tool_end` → 工具结果
     - 最终文本 → 答案内容

3. **删除 `src/lib/react-agent.ts`**

**核心代码结构**：

```typescript
// langgraph-agent.ts（概念代码）
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { chatTools } from '@/services/ai/tools';
import { createOpenAIModel } from '@/lib/ai';

export async function createChatAgent(systemPrompt: string) {
  const model = await createOpenAIModel({ scenario: 'chat' });
  const modelWithTools = model.bindTools(chatTools);

  return createReactAgent({
    llm: modelWithTools,
    tools: chatTools,
    prompt: systemPrompt,
  });
}
```

**验证**：后端 API 正常返回流式响应

---

### 阶段 3：流式协议适配（预计 1 天）

**目标**：将 LangGraph stream events 映射到前端的 XML 标签协议

**任务**：

1. **重写 `src/lib/stream-tags.ts` 的 `StreamTagGenerator`**
   - 基本保留：`generateThink`、`startStep`、`endStep`、`startContent`、`endContent`
   - 这些标签格式不变，前端解析器不需要改

2. **重写 `agent.ts` 中的事件映射逻辑**
   - LangGraph `streamEvents` 事件 → XML 标签流的转换

   ```
   LangGraph Event                    →  XML 标签
   ─────────────────────────────────────────────────
   初始化阶段                          →  <think content="正在初始化..."/>
   on_chat_model_stream (thinking)     →  <step type="thought" index="N">内容</step>
   on_tool_start                       →  <step type="action" index="N">搜索信息</step>
   on_tool_end                         →  <step type="observation" index="N">结果</step>
   on_chat_model_stream (final answer) →  <startContent/>内容<endContent/>
   完成                                →  关闭流
   ```

3. **前端 `stream-tags.ts` 的 `StreamTagParser`**
   - **大概率不需要改**：XML 标签协议保持兼容
   - 如果 LangGraph 的事件时序有差异，微调即可

**关键点**：XML 标签协议是前后端的契约，保持协议不变可以最大程度减少前端改动。

**验证**：前端能正确展示思考步骤和最终答案

---

### 阶段 4：前端适配（预计 0.5 天）

**目标**：前端适配可能的流式协议微调

**任务**：

1. **检查 `src/app/chat/page.tsx`**
   - 如果 XML 标签协议完全兼容，改动极小或无需改动
   - 需要验证的回调：`onThink`、`onStep`、`onContent`、`onComplete`

2. **移除 `filterJsonRpc` 函数**
   - 不再需要过滤 JSON-RPC 代码块（原生 function calling 不输出文本格式的工具调用）

3. **微调 `MessageContent` 组件**
   - 思考步骤展示可能需要适配新的内容格式
   - 移除 JSON-RPC 相关的过滤逻辑

**验证**：完整聊天流程端到端测试通过

---

### 阶段 5：清理与文档（预计 0.5 天）

**目标**：删除冗余代码，更新文档

**任务**：

1. **删除废弃代码**
   - `src/lib/react-agent.ts`（如果阶段 2 未删除）
   - JSON-RPC 相关类型和工具函数
   - `filterJsonRpc` 等前端清理函数

2. **更新规范文档**
   - `docs/rules/backend.md` — AI 服务部分，移除手写 ReAct 说明，新增 LangGraph 说明
   - `docs/designs/chat/rag-chat.md` — 架构图更新
   - `docs/rules/directory-structure.md` — 如有目录变更

3. **处理旧计划文档**
   - `docs/plans/chat-system-simplification.md` — 标记为废弃（已被本计划替代）
   - 更新 `docs/plans/README.md`

4. **发布博客文章**（可选）
   - 记录迁移过程和技术决策

**验证**：文档一致性检查，旧文件清理完成

---

## 预期收益

### 代码量变化

| 模块 | 改造前 | 改造后（估） | 减少 |
|------|--------|-------------|------|
| ReAct 循环 (`react-agent.ts`) | 370 行 | **0 行**（删除） | -370 |
| 工具系统 (`tools/index.ts`) | 290 行 | ~50 行（导出 + zod schema） | -240 |
| Agent 编排 (`rag/agent.ts`) | 330 行 | ~180 行 | -150 |
| 流式标签 (`stream-tags.ts`) | 280 行 | ~200 行（事件映射简化） | -80 |
| 前端页面 (`chat/page.tsx`) | 600 行 | ~550 行 | -50 |
| **合计** | **2665 行** | **~1480 行** | **~44%** |

### 质量提升

| 维度 | 改造前 | 改造后 |
|------|--------|--------|
| 工具调用 | 手写 JSON-RPC 正则解析 | 原生 Function Calling |
| Agent 循环 | 手写 370 行 | LangGraph 内置 |
| 流式处理 | 自定义 chunk 解析 + 多种格式兼容 | LangGraph 标准 streamEvents |
| 可扩展性 | 手动注册工具 | 加一个 Tool 到数组即可 |
| 调试体验 | 手写 console.log | LangSmith / LangGraph Dev Studio |

---

## 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| GLM-4.7 的 OpenAI 兼容接口与 LangChain 的 bindTools 不完全兼容 | 高 | 中 | 先用最小代码验证 `model.bindTools()` + `createReactAgent` 能跑通 |
| LangGraph streamEvents 事件格式与前端 XML 标签协议不匹配 | 中 | 中 | 保留 XML 标签协议作为中间层，只改后端映射逻辑 |
| 前端 ReAct 步骤展示需要较大改动 | 中 | 低 | XML 协议保持兼容，前端改动最小化 |
| LangGraph 增加包体积 | 低 | 高 | `@langchain/langgraph` 已在 package.json 中，无新增依赖 |

### 关键验证点

在正式开始前，建议先做 **技术验证**（2-3 小时）：

1. 验证 `ChatOpenAI.bindTools()` 与 GLM-4.7 能正常工作
2. 验证 `createReactAgent` 的 stream 输出格式
3. 验证 `agent.streamEvents()` 的事件类型

如果验证失败，备选方案是使用 `@langchain/core` 手动构建 Agent 图（`StateGraph`），而非使用 `createReactAgent` 预构建。

---

## 依赖变更

### 已有依赖（无需新增）

```json
{
  "@langchain/anthropic": "^1.3.26",
  "@langchain/core": "^1.1.38",
  "@langchain/langgraph": "^1.2.6",
  "@langchain/openai": "^1.4.1"
}
```

### 可能需要新增

```json
{
  "zod": "^3.x"  // 如果项目中尚未安装，用于 StructuredTool 参数定义
}
```

---

## 时间估算

| 阶段 | 内容 | 预计时间 |
|------|------|---------|
| 技术验证 | bindTools / createReactAgent / streamEvents 验证 | 2-3 小时 |
| 阶段 1 | LangChain Tools 改造 | 0.5 天 |
| 阶段 2 | LangGraph Agent 核心 | 1 天 |
| 阶段 3 | 流式协议适配 | 1 天 |
| 阶段 4 | 前端适配 | 0.5 天 |
| 阶段 5 | 清理与文档 | 0.5 天 |
| **合计** | | **3-4 天** |

---

## 验证清单

### 功能验证

- [ ] 单轮问答正常工作
- [ ] 多轮对话保持上下文
- [ ] 向量搜索工具正常调用（search_articles）
- [ ] 元数据搜索工具正常调用（search_posts_meta）
- [ ] 合集搜索工具正常调用（search_collection）
- [ ] 多轮 ReAct 循环（思考 → 工具 → 观察 → 答案）
- [ ] 无需工具的闲聊直接回答
- [ ] 流式响应实时输出
- [ ] 前端 ReAct 步骤正确展示
- [ ] 错误处理和降级

### 性能验证

- [ ] 首字延迟合理（< 2s）
- [ ] 总响应时间无明显退化
- [ ] 并发请求无异常

---

**文档版本**：v1.0
**创建日期**：2026-04-28
**关联文档**：
- [聊天系统简化方案](./chat-system-simplification.md)（将被本计划替代）
- [RAG 聊天系统设计](../designs/chat/rag-chat.md)
- [后端开发规范](../rules/backend.md)
