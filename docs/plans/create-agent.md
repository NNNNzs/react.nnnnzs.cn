# 草稿库创作 Agent 助手

> 状态：🔄 进行中（第一期已落地）
> 创建时间：2026-07-07
> 目标入口：`/create/drafts/[id]`（草稿详情页）
> 关联：`content_templates` 模板管理、本地 `~/project/xhs`

## 一、目标

在草稿详情页唤起一个对话式创作助手：用户说「把这篇扩展成 3 张小红书图卡」，助手自动读模板、写文案、调文生图、把生成的结构化建议提交给前端，用户对比差异后确认应用。本质是用 LangGraph ReAct Agent 把分散的 `content_*` API 和图片生成能力串成可对话、可调用工具、可产出结构化建议的助手。

## 二、核心设计决策

1. **唤起位置**：仅 `/create/drafts/[id]`。新建草稿走传统表单。
2. **独立服务**：新建 `src/services/ai/create-agent/`，不扩展 chat-agent。复用 `createOpenAIModel`，新增 `create_agent` scenario，通过 `/c/config` 场景绑定选择模型。
3. **System prompt 来源**：`content_templates` 表（`scenario = 'content_agent'`），可在线编辑，不在文件系统。
4. **流式协议**：标准 SSE（`text/event-stream`）多事件，公用基础设施在 `src/lib/sse.ts`。不复用 chat-agent 的 XML 标签协议。
5. **草稿回填（方案 B）**：agent 不直接写库，通过 `emit_draft_patch` 伪工具产出 `patch` SSE 事件；前端收到后先进入待确认状态，并显示「查看对比」入口。用户点击后用 `ContentDiffViewer` 对比当前表单和 AI 建议，确认后才应用到表单 state，用户点保存才落库。图片 attach 这一步也等用户确认后走 `/images` 接口即时落库（资产级别）。
6. **会话持久化**：第一期不持久化（前端内存）。
7. **前端助手抽象**：SSE 事件消费统一在 `useAgentStream`，业务助手统一走 `useAssistantAgent<TPatch>` + `AgentAssistantPanel`。草稿详情、后续选题中心只配置 endpoint、patch 类型、patch 应用函数、快捷提示和文案，不重复写 Drawer、消息气泡、滚动和 `tool_start/tool_end/patch` 处理。
8. **Patch 可审阅**：需要展示「改了什么」的场景统一使用 `ContentDiffViewer`，当前已覆盖文章版本历史、AI Lab Prompt 版本对比和创作助手草稿建议确认；后续选题中心 patch 预览继续复用该组件做字段级对比。

## 三、实现清单

### 已落地

- [x] `src/lib/sse.ts`：公用 SSE 编解码（`encodeSSE` / `createSSEResponse` / `parseSSEStream`）
- [x] `src/lib/ai-scenarios.ts`：注册 `create_agent` scenario 元数据
- [x] `src/services/content-creation.ts`：`XhsPromptTemplateSeed` 支持内置 `content`；新增 `content_agent` system prompt seed
- [x] `src/services/ai/create-agent/`：`prompt.ts`（从模板加载）、`create-agent.ts`（LangGraph + SSE 编码）、`index.ts`
- [x] `src/services/ai/tools/create-tools/`：`read_prompt_template`、`get_draft`、`search_posts`、`get_post_content`、`web_search`、`generate_image`、`poll_image_job`、`emit_draft_patch`；`buildCreateTools` 闭包工厂；`draft-patch.ts` 共享类型
- [x] `src/app/api/create/drafts/[id]/chat/route.ts`：SSE 路由，`requireAuth`
- [x] `src/hooks/useAgentStream.ts`：通用 Agent SSE 事件消费（tool / think / content / patch）
- [x] `src/hooks/useAssistantAgent.ts`：业务助手场景封装（endpoint / typed patch / send options）
- [x] `src/components/agent/AgentAssistantPanel.tsx`：通用 Drawer 对话面板
- [x] `src/app/create/_components/useCreateAgent.ts`：草稿场景 hook（只保留 draft endpoint + DraftPatch）
- [x] `src/app/create/_components/CreateAgentPanel.tsx`：创作助手场景配置（标题、快捷提示、patch 提醒）
- [x] `CreateDraftEditor.tsx`：接入助手按钮 + `emit_draft_patch` 待确认状态 + 查看对比按钮 + 用户确认后应用 patch
- [x] `src/components/diff/ContentDiffViewer.tsx`：通用文本差异组件，已替换博客版本历史与 AI Lab Prompt 版本对比

### SSE 事件协议

| event | data | 触发 |
|-------|------|------|
| `meta` | `{ scenario, draftId }` | 流开始 |
| `token` | `{ content }` | 模型流式输出 |
| `tool_start` | `{ tool, args, runId, step }` | 工具开始 |
| `tool_end` | `{ tool, result, runId, step }` | 工具结束 |
| `patch` | `{ title?, hook?, body?, tags?, status?, addImages? }` | 草稿建议（由 `emit_draft_patch` 伪工具触发） |
| `error` | `{ message }` | 异常 |
| `done` | `{}` | 结束 |

## 四、后续选题中心助手接入规划

选题中心不再复制草稿详情的事件处理，只新增一个薄业务层：

1. 后端新增 `/api/create/topics/[id]/chat` 或列表级 `/api/create/topics/chat`，继续输出统一 SSE 事件：`meta`、`think_*`、`tool_start`、`tool_end`、`content_chunk`、`patch`、`done`、`error`。
2. 定义 `TopicPatch`，例如 `{ title?, description?, pillar?, series?, priority?, sourceNote?, draftDirection? }`，并在页面实现 `applyTopicPatch`，只负责把 patch 合并到选题表单或详情 state。
3. 前端新增 `useTopicAgent`，内部调用 `useAssistantAgent<TopicPatch>`，配置 endpoint 和必要的 `body`，例如 topicId、sourcePostId、当前筛选条件。
4. 选题页面直接复用 `AgentAssistantPanel`，只替换标题、快捷提示、空状态文案和 patch 提醒。
5. 选题 patch 默认也走人工确认：收到 patch 后显示「查看对比」入口，用户点击后用 `ContentDiffViewer` 展示「当前选题字段 JSON / 文案」与「AI 建议」差异，再由用户确认应用。

## 五、验证

1. `/c/config` 场景绑定中激活 `create_agent` scenario（需支持 function calling 的模型）
2. `/create/templates` 点「导入 xhs」写入 `content_agent` system prompt 模板（否则走内置 fallback）
3. `pnpm dev` 启动，打开 `/create/drafts/<id>`
4. 场景：文案建议、`emit_draft_patch` 后出现查看对比入口、点击后打开确认弹窗、确认后应用表单（不保存刷新可逆）、顶部「保存」按钮落库、文生图全链路、博客检索、断流停止
5. 工具调用验收：`load_prompt_skill_template` 能按 slug 读取完整 Skill，`search_posts` 能返回检索结果或空结果，`web_search` 能用 Tavily 返回网页搜索结果，`emit_draft_patch` 成功后只代表前端收到待确认建议，不代表表单已应用或数据库已保存
6. `pnpm typecheck` / `pnpm lint` 通过

## 六、非目标 / 后置

- 会话持久化（`content_agent_sessions` 表）
- TTS 旁白工具（复用 `synthesize_speech`）
- 小红书自动发布（沿用「只备素材，手动发布」）
- chat-agent 迁移到 SSE（独立后续任务）
- content 中台 RBAC 权限码（第一期仅 `requireAuth`）
- content 抽取逻辑复用 chat-agent 的 `extractTextContent`（需先抽公共模块）
