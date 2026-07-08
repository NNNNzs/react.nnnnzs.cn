# 草稿库创作 Agent 助手

> 状态：🔄 进行中（第一期已落地）
> 创建时间：2026-07-07
> 目标入口：`/create/drafts/[id]`（草稿详情页）
> 关联：`content_templates` 模板管理、本地 `~/project/xhs`

## 一、目标

在草稿详情页唤起一个对话式创作助手：用户说「把这篇扩展成 3 张小红书图卡」，助手自动读模板、写文案、调文生图、把生成的图建议回填到草稿表单。本质是用 LangGraph ReAct Agent 把分散的 `content_*` API 和图片生成能力串成可对话、可调用工具、可产出结构化建议的助手。

## 二、核心设计决策

1. **唤起位置**：仅 `/create/drafts/[id]`。新建草稿走传统表单。
2. **独立服务**：新建 `src/services/ai/create-agent/`，不扩展 chat-agent。复用 `createOpenAIModel`，新增 `create_agent` scenario，通过 `/c/config` 场景绑定选择模型。
3. **System prompt 来源**：`content_templates` 表（`scenario = 'content_agent'`），可在线编辑，不在文件系统。
4. **流式协议**：标准 SSE（`text/event-stream`）多事件，公用基础设施在 `src/lib/sse.ts`。不复用 chat-agent 的 XML 标签协议。
5. **草稿回填（方案 B）**：agent 不直接写库，通过 `emit_draft_patch` 伪工具产出 `draft_patch` SSE 事件；前端收到后填入表单 state，用户点保存才落库。图片 attach 这一步走 `/images` 接口即时落库（资产级别）。
6. **会话持久化**：第一期不持久化（前端内存）。

## 三、实现清单

### 已落地

- [x] `src/lib/sse.ts`：公用 SSE 编解码（`encodeSSE` / `createSSEResponse` / `parseSSEStream`）
- [x] `src/lib/ai-scenarios.ts`：注册 `create_agent` scenario 元数据
- [x] `src/services/content-creation.ts`：`XhsPromptTemplateSeed` 支持内置 `content`；新增 `content_agent` system prompt seed
- [x] `src/services/ai/create-agent/`：`prompt.ts`（从模板加载）、`create-agent.ts`（LangGraph + SSE 编码）、`index.ts`
- [x] `src/services/ai/tools/create-tools/`：`read_prompt_template`、`get_draft`、`search_posts`、`get_post_content`、`generate_image`、`poll_image_job`、`emit_draft_patch`；`buildCreateTools` 闭包工厂；`draft-patch.ts` 共享类型
- [x] `src/app/api/create/drafts/[id]/chat/route.ts`：SSE 路由，`requireAuth`
- [x] `src/app/create/_components/useCreateAgent.ts`：SSE 消费 hook
- [x] `src/app/create/_components/CreateAgentPanel.tsx`：Drawer 对话面板
- [x] `CreateDraftEditor.tsx`：接入助手按钮 + `handleAgentPatch` 应用 patch

### SSE 事件协议

| event | data | 触发 |
|-------|------|------|
| `meta` | `{ scenario, draftId }` | 流开始 |
| `token` | `{ content }` | 模型流式输出 |
| `tool_start` | `{ tool, args, runId, step }` | 工具开始 |
| `tool_end` | `{ tool, result, runId, step }` | 工具结束 |
| `draft_patch` | `{ title?, hook?, body?, tags?, status?, addImages? }` | 草稿建议 |
| `error` | `{ message }` | 异常 |
| `done` | `{}` | 结束 |

## 四、验证

1. `/c/config` 场景绑定中激活 `create_agent` scenario（需支持 function calling 的模型）
2. `/create/templates` 点「导入 xhs」写入 `content_agent` system prompt 模板（否则走内置 fallback）
3. `pnpm dev` 启动，打开 `/create/drafts/<id>`
4. 场景：文案建议、patch 填表单（不保存刷新可逆）、保存落库、文生图全链路、博客检索、断流停止
5. `pnpm typecheck` / `pnpm lint` 通过

## 五、非目标 / 后置

- 会话持久化（`content_agent_sessions` 表）
- TTS 旁白工具（复用 `synthesize_speech`）
- 小红书自动发布（沿用「只备素材，手动发布」）
- chat-agent 迁移到 SSE（独立后续任务）
- content 中台 RBAC 权限码（第一期仅 `requireAuth`）
- content 抽取逻辑复用 chat-agent 的 `extractTextContent`（需先抽公共模块）
