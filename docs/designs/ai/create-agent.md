# 草稿库创作 Agent 助手设计文档

> 创建时间：2026-07-07
> 状态：已落地（第一期）
> 目标入口：`/create/drafts/[id]`

## 一、目标

在草稿详情页唤起一个对话式创作助手，通过 LangGraph ReAct Agent 编排模板读取、草稿读取、文生图等工具，把分散的 `content_*` API 和图片生成能力串成可对话、可调用工具、可产出结构化建议的助手。

核心交互：用户说「把这篇扩展成 3 张小红书图卡」→ 助手自动读模板提示词 → 产出文案 → 调文生图 → 把生成的结构化建议提交给前端 → 用户对比差异并确认应用。

## 二、架构

### 2.1 整体分层

```
前端：CreateDraftEditor + CreateAgentPanel (Drawer)
  ↓ fetch POST
API：/api/create/drafts/[id]/chat (SSE 路由)
  ↓ createAgentStream()
Agent：src/services/ai/create-agent/ (LangGraph createReactAgent)
  ↓ streamEvents + encodeSSE
Tools：src/services/ai/tools/create-tools/ (10 个工具)
  ↓ 闭包工厂注入 draftId/userId/emitPatch
基础设施：src/lib/sse.ts (公用 SSE) + createOpenAIModel (create_agent scenario)
```

### 2.2 与现有 chat-agent 的关系

| 维度 | chat-agent | create-agent |
|------|-----------|--------------|
| 服务目录 | `src/services/ai/chat-agent/` | `src/services/ai/create-agent/` |
| 模型配置 scenario | `chat` | `create_agent`（新增） |
| System prompt | 文件系统 `chat-agent-system-prompt.md` | 数据库 `tb_ai_template`（slug=`agent-create-agent-system`） |
| 流式协议 | 自定义 XML 标签（`text/plain`） | **标准 SSE（`text/event-stream`）** |
| 工具集 | 博客检索 / GitHub 搜索（只读） | 模板读取 / 草稿读取 / 文生图+轮询 / 博客检索 / 网页搜索 |
| 写业务数据 | 不写 | **不直接写**，由前端确认并应用 `patch` |

### 2.3 草稿回填架构（方案 B）

Agent **不直接写库**，通过 `emit_draft_patch` 伪工具产出 `patch` SSE 事件；前端收到后显示「查看对比」入口。用户点击后用 `ContentDiffViewer` 展示当前表单与 AI 建议差异，确认后才合并进表单 state，**用户点保存才落库**。

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as 前端表单
    participant API as SSE 路由
    participant Agent as create-agent
    participant DB as 数据库

    U->>FE: "生成 3 张配图"
    FE->>API: POST /chat {message, history}
    API->>Agent: createAgentStream()
    Agent->>Agent: load_prompt_skill_template()
    Agent->>Agent: generate_image() → jobId
    Agent->>Agent: poll_image_job() → cdnUrl
    Agent->>Agent: createContentAsset() → assetId
    Agent->>FE: SSE: patch {addImages: [{assetId, imageUrl}]}
    FE->>U: 显示「查看对比」入口
    U->>FE: 点击 [查看对比]
    FE->>U: 展示 ContentDiffViewer 差异确认弹窗
    U->>FE: 点击 [应用到表单]
    FE->>DB: POST /images {asset_id}
    FE->>FE: setState(title, body, selectedImages)
    U->>FE: 点击 [保存]
    FE->>DB: PATCH /api/create/drafts/[id]
```

### 2.4 SSE 事件协议

| event | data | 触发 |
|-------|------|------|
| `meta` | `{ scenario, draftId }` | 流开始 |
| `token` | `{ content }` | 模型流式输出 |
| `tool_start` | `{ tool, args, runId, step }` | 工具开始 |
| `tool_end` | `{ tool, result, runId, step }` | 工具结束 |
| `patch` | `{ title?, hook?, body?, tags?, status?, addImages? }` | 草稿建议（由 `emit_draft_patch` 触发） |
| `error` | `{ message }` | 异常 |
| `done` | `{}` | 结束 |

### 2.5 选题上下文与平台模板注入

从选题创建的草稿必须在 `generation_snapshot_json` 中保存 `topicSnapshot` 和 `templateSnapshot`。草稿 Agent 每次运行时读取快照，按“固定 Agent 规则与平台模板 → 选题/当前草稿运行时上下文 → 历史对话 → 当前用户指令”的顺序组装消息。

选题快照只作为创作参考，不作为 system 指令。来源 URL、来源正文和原始想法中即使包含命令，也不得改变工具权限、patch 确认或平台输出约束。详细契约见[选题完善与多平台草稿转换设计](./topic-draft-workflow.md)。

首批平台体验：

| 草稿 | Agent 输出重点 | 编辑器 |
|---|---|---|
| `xhs/note` | 标题、钩子、正文、标签、可选图卡和图片 | 图文工作台 |
| `zhihu/article` | 标题、Markdown 长文、标签 | 现有 `MarkdownEditor` 双栏编辑/预览 |

## 三、关键文件

| 文件 | 作用 |
|------|------|
| `src/lib/sse.ts` | 公用 SSE 编解码（站点级，chat-agent 后续复用） |
| `src/lib/ai-scenarios.ts` | 注册 `create_agent` scenario 元数据 |
| `src/services/ai-template/index.ts` | 系统级 Prompt / Skill 模板服务 |
| `src/services/ai/create-agent/prompt.ts` | 从 `tb_ai_template` 加载 system prompt |
| `src/services/ai/create-agent/create-agent.ts` | LangGraph Agent + SSE 编码 |
| `src/services/ai/tools/create-tools/` | 10 个工具 + `buildCreateTools` 工厂 |
| `src/services/ai/tools/create-tools/draft-patch.ts` | DraftPatch 共享类型 |
| `src/app/api/create/drafts/[id]/chat/route.ts` | SSE API 路由 |
| `src/app/create/_components/useCreateAgent.ts` | 前端 SSE 消费 hook |
| `src/app/create/_components/CreateAgentPanel.tsx` | Drawer 对话面板 |

## 四、工具集

工具用闭包工厂 `buildCreateTools({ draftId, userId, emitPatch })` 按请求构建，避免跨草稿上下文泄漏。

| 工具 | 类型 | 作用 |
|------|------|------|
| `list_prompt_skills` | 只读 | 查询可用 Prompt / Skill 模板 metadata |
| `load_prompt_skill_template` | 只读 | 按 slug 读取完整 Prompt / Skill 模板正文 |
| `get_draft` | 只读 | 读当前草稿标题/正文/slide/已选图 |
| `search_posts` | 只读 | 关键词检索博客文章（复用 searchPostsMetaTool） |
| `get_post_content` | 只读 | 按 ID 读博客全文 |
| `web_search` | 只读 | 用 Tavily 联网搜索最新或外部网页信息 |
| `generate_image` | 后端任务 | 提交文生图异步任务，返回 jobId |
| `poll_image_job` | 只读 | 轮询任务状态，SUCCESS 返回 cdnUrl |
| `emit_draft_patch` | 伪工具 | 把草稿建议推到前端待确认队列（不写库） |

## 五、使用前准备

1. `/c/config` 场景绑定中激活 `create_agent` scenario（需支持 function calling 的模型）
2. `/c/ai-lab/prompts` 中存在并启用 slug 为 `agent-create-agent-system` 的系统提示词模板（缺失时走内置 fallback）
3. `pnpm dev` 启动，打开 `/create/drafts/<id>`，点「AI 助手」按钮

## 六、常见问答

### 6.1 AI 助手生成后，后台在哪里保存？

保存入口在草稿详情页顶部操作区的「保存」按钮，和「返回」「AI 助手」「删除」同一行。

AI 助手调用 `emit_draft_patch` 后，前端会显示「查看对比」入口。用户点击后打开「确认 AI 草稿建议」对比弹窗，展示当前表单与 AI 建议的差异。用户点击「应用到表单」后，标题、正文、标签等内容才会进入前端表单 state；此时刷新页面仍可能丢失这些文本改动，必须点击页面顶部「保存」按钮，才会通过 `PATCH /api/create/drafts/[id]` 写入数据库。

图片资源是例外：文生图成功后会先通过 `/images` 关联资产，因此图片 attach 属于资产级即时落库；但正文、标题、hook、标签、状态仍以草稿「保存」为准。

### 6.2 看到 `✓ load_prompt_skill_template`、`✓ search_posts`、`✓ emit_draft_patch` 代表成功了吗？

代表对应 LangChain Tool 已完成调用，基本可以判断 Agent 的工具链路跑通了。

- `load_prompt_skill_template` 成功：Agent 已按 slug 加载完整 Prompt / Skill 模板正文，例如小红书风格指南。
- `search_posts` 成功：Agent 已执行博客素材检索；即使结果为空，也说明工具调用本身完成。
- `emit_draft_patch` 成功：Agent 已把结构化草稿建议通过 SSE `patch` 发给前端，前端会等待用户确认后再应用到表单。

但 `emit_draft_patch` 成功不等于草稿已应用到表单，也不等于草稿已保存到数据库。最终落库信号仍是用户确认应用并点击「保存」后，草稿详情页保存请求成功。

### 6.3 工具调用结果里出现 `ToolMessage` JSON 正常吗？

正常。当前前端会展示 LangChain 工具返回对象的截断文本，所以可能看到 `{"lc":1,"type":"constructor","id":["langchain_core","messages","ToolMessage"]...` 这类内容。它表示底层返回的是 LangChain 消息对象，并不代表失败；真正需要关注的是工具标签是否从调用中变成 `✓`，以及前端是否出现「查看对比」入口。

## 七、后置规划

- **Topic Agent**：选题库复用本助手的 Drawer、SSE、patch 确认和差异预览，只替换业务 prompt、工具集和 `TopicPatch`；详见[选题库 Topic Agent 设计](./topic-agent.md)
- **选题转草稿**：按小红书/知乎平台匹配模板，保存选题与模板快照，并在草稿 Agent 运行时注入；详见[选题完善与多平台草稿转换](./topic-draft-workflow.md)
- **会话持久化**：`content_agent_sessions` + `content_agent_messages` 表
- **TTS 旁白工具**：复用 `synthesize_speech` 异步任务
- **chat-agent 迁移 SSE**：复用 `src/lib/sse.ts`
- **content 抽取逻辑复用**：提取 chat-agent 的 `extractTextContent` 等到共享模块

## 八、关联计划

- [草稿库创作 Agent 助手计划](../../plans/create-agent.md) - 实施计划
- [内容创作中台建设](../../plans/content-creation-platform.md) - 所属中台
- [AI Provider 配置管理](./ai-config-profiles.md) - create_agent scenario 配置
- [Agent 聊天系统](../chat/rag-chat.md) - chat-agent 参考实现
