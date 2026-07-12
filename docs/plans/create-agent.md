# 草稿库创作 Agent 助手

> 状态：🔄 进行中（第一期已落地）
> 创建时间：2026-07-07
> 目标入口：`/create/drafts/[id]`（草稿详情页）
> 关联：AI Lab Prompts、本地 `~/project/xhs`

## 一、目标

在草稿详情页唤起一个对话式创作助手：用户说「把这篇扩展成 3 张小红书图卡」，助手按需读取风格 Skill、写文案和图片提示词计划、把结构化建议提交给前端；用户确认后再手动提交图片生成。本质是用 LangGraph ReAct Agent 把实时草稿上下文、AI Lab 模板和可审阅的草稿建议串成创作工作流。

## 二、核心设计决策

1. **唤起位置**：仅 `/create/drafts/[id]`。新建草稿走传统表单。
2. **独立服务**：新建 `src/services/ai/create-agent/`，不扩展 chat-agent。复用 `createOpenAIModel`，新增 `create_agent` scenario，通过 `/c/config` 场景绑定选择模型。
3. **System prompt 来源**：`tb_ai_template` 表（slug=`agent-create-agent-system`），可在 AI Lab Prompts 在线编辑，不在文件系统。
4. **流式协议**：标准 SSE（`text/event-stream`）多事件，公用基础设施在 `src/lib/sse.ts`。不复用 chat-agent 的 XML 标签协议。
5. **草稿回填（方案 B）**：Agent 不直接写库，通过 `emit_draft_patch` 伪工具产出 `patch` SSE 事件；前端立即展示对比，用户确认后才应用。`emit_draft_patch` 配置 `returnDirect`，补丁提交后结束本轮 Agent。正文等字段仍由页面「保存」落库；图卡计划在确认时持久化，图片生成仅能由用户点击页面按钮触发。
6. **会话持久化**：第一期不持久化（前端内存）。
7. **前端助手抽象**：SSE 事件消费统一在 `useAgentStream`，业务助手统一走 `useAssistantAgent<TPatch>` + `AgentAssistantPanel`。草稿详情、后续选题中心只配置 endpoint、patch 类型、patch 应用函数、快捷提示和文案，不重复写 Drawer、消息气泡、滚动和 `tool_start/tool_end/patch` 处理。
8. **Patch 可审阅**：需要展示「改了什么」的场景统一使用 `ContentDiffViewer`，当前已覆盖文章版本历史、AI Lab Prompt 版本对比和创作助手草稿建议确认；后续选题中心 patch 预览继续复用该组件做字段级对比。

## 三、实现清单

### 已落地

- [x] `src/lib/sse.ts`：公用 SSE 编解码（`encodeSSE` / `createSSEResponse` / `parseSSEStream`）
- [x] `src/lib/ai-scenarios.ts`：注册 `create_agent` scenario 元数据
- [x] `src/services/ai-template/index.ts`：提供系统级 Prompt / Skill 模板服务
- [x] `src/services/ai/create-agent/`：`prompt.ts`（从模板加载）、`create-agent.ts`（LangGraph + SSE 编码）、`index.ts`
- [x] `src/services/ai/tools/create-tools/`：`list_prompt_skills`、`load_prompt_skill_template`、`get_draft`、`search_posts`、`get_post_content`、`web_search`、`emit_draft_patch`；`buildCreateTools` 闭包工厂；`draft-patch.ts` 共享类型
- [x] `src/app/api/create/drafts/[id]/chat/route.ts`：SSE 路由，`requireAuth`
- [x] `src/hooks/useAgentStream.ts`：通用 Agent SSE 事件消费（tool / think / content / patch）
- [x] `src/hooks/useAssistantAgent.ts`：业务助手场景封装（endpoint / typed patch / send options）
- [x] `src/components/agent/AgentAssistantPanel.tsx`：通用 Drawer 对话面板
- [x] `src/app/create/_components/useCreateAgent.ts`：草稿场景 hook（发送时注入页面实时上下文）
- [x] `src/app/create/_components/CreateAgentPanel.tsx`：创作助手场景配置（标题、快捷提示、patch 提醒）
- [x] `CreateDraftEditor.tsx`：接入助手按钮 + 自动打开补丁对比 + 待确认图卡提示词预览 + 用户确认后应用 patch
- [x] 图卡计划与图片生成：新增 `/slides` 持久化 API、单张图卡生成 API、编辑器提示词编辑与状态刷新；Agent 无自动出图权限
- [x] `src/components/diff/ContentDiffViewer.tsx`：通用文本差异组件，已替换博客版本历史与 AI Lab Prompt 版本对比

### SSE 事件协议

| event | data | 触发 |
|-------|------|------|
| `meta` | `{ scenario, draftId }` | 流开始 |
| `token` | `{ content }` | 模型流式输出 |
| `tool_start` | `{ tool, args, runId, step }` | 工具开始 |
| `tool_end` | `{ tool, result, runId, step }` | 工具结束 |
| `patch` | `{ title?, hook?, body?, tags?, status?, addImages?, slides? }` | 草稿建议（由 `emit_draft_patch` 伪工具触发） |
| `error` | `{ message }` | 异常 |
| `done` | `{}` | 结束 |

## 四、选题 Agent 接入规划

完整设计见：[选题库 Topic Agent 设计](../designs/ai/topic-agent.md)和[选题完善与多平台草稿转换](../designs/ai/topic-draft-workflow.md)。本计划只记录与草稿 Agent 的复用边界：

1. 后端新增 `/api/create/topics/chat`，已有选题详情场景再增加 `/api/create/topics/[id]/chat`，继续输出统一 SSE 事件。
2. 定义独立的 `TopicPatch`：`title`、来源信息、`originalIdea`、`coreAngle`、`keyPoints` 和 `status`，不复用草稿 patch 的正文、图片字段。
3. 新增 `useTopicAgent`，内部调用 `useAssistantAgent<TopicPatch>`，只配置 topic endpoint、上下文和快捷提示。
4. 选题页面直接复用 `AgentAssistantPanel`、`useAgentStream` 和 `ContentDiffViewer`，不复制 Drawer、消息和流事件处理。
5. Topic Agent 使用独立的 `topic_agent` scenario 和工具集，重点接入已有选题检索、博客检索、网页搜索、来源读取和 `emit_topic_patch`。
6. 选题确认保存后，平台草稿仍由草稿库创作 Agent 按 `选题 + 平台 + 模板` 继续生成。

## 五、选题上下文与知乎 Markdown 接入

1. 草稿创建时保存 `topicSnapshot` 和草稿类型；后续修改选题不回写历史草稿，写作风格由运行时动态 Skill 选择。
2. 草稿 Agent 每次运行时比较页面与数据库草稿；页面有未保存改动时注入实时页面上下文，否则读取数据库上下文，并把选题作为受控参考注入。
3. 创建草稿不自动调用模型；草稿页只提供创作助手入口，由用户输入指令后触发 chat/SSE 流程。
4. `xhs/note` 继续使用图文工作台；`zhihu/article` 复用现有 `MarkdownEditor` 编辑和预览 Markdown。
5. 图文和长文分别由对应的写作风格 Skill 约束输出，继续共用 `DraftPatch`、差异确认和保存语义。

## 六、验证

1. `/c/config` 场景绑定中激活 `create_agent` scenario（需支持 function calling 的模型）
2. `/c/ai-lab/prompts` 中存在并启用 slug=`agent-create-agent-system` 的系统提示词模板（否则走内置 fallback）
3. `pnpm dev` 启动，打开 `/create/drafts/<id>`
4. 场景：文案建议、`emit_draft_patch` 后自动打开确认弹窗、确认后应用表单（不保存刷新可逆）、顶部「保存」按钮落库、图卡提示词持久化、用户点击后图片生成、博客检索、断流停止
5. 工具调用验收：草稿 Agent 先列出 Skill metadata，再按当前草稿类型加载所需风格指南；`emit_draft_patch` 后本轮必须结束，且不得创建图片任务。Topic Agent 的选题检索、来源读取、网页搜索和 `emit_topic_patch` 成功后只代表前端收到待确认建议，不代表选题已应用或数据库已保存
6. `pnpm typecheck` / `pnpm lint` 通过
7. 从同一个选题分别创建图文和长文草稿，验证草稿类型、选题快照、动态风格 Skill 选择和 Topic 状态更新
8. 验证 `zhihu/article` 使用 Markdown 编辑器，Markdown 保存后可原样重新加载
9. 验证来源选题包含类似命令的文本时不会改变 Agent 工具权限和 patch 确认规则

## 七、非目标 / 后置

- 会话持久化（`content_agent_sessions` 表）
- TTS 旁白工具（复用 `synthesize_speech`）
- 小红书自动发布（沿用「只备素材，手动发布」）
- chat-agent 迁移到 SSE（独立后续任务）
- 更细的 content 中台 RBAC 权限拆分（当前已使用 `CONTENT_VIEW` / `CONTENT_CREATE`）
- content 抽取逻辑复用 chat-agent 的 `extractTextContent`（需先抽公共模块）
