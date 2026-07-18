# AI Agent 工具系统

Chat、Create、Topic Agent 共用同一套 LangChain 工具定义，并把工具能力定义、请求级上下文和 Agent 白名单分成三层。

## 目录分层

| 文件 | 职责 |
| --- | --- |
| `article-tools.ts` | `search_articles`、`search_posts`、`get_post_content` 唯一定义 |
| `prompt-template-tools.ts` | Prompt Skill list/load schema 与 Agent scope 策略实例 |
| `web-tools.ts` | `web_search`、`read_source_url` 唯一定义 |
| `chat-tools.ts` | Chat 能力白名单，以及 Chat 专属合集/GitHub 工具 |
| `create-tools/agent-tools.ts` | 注入当前 draft、actor 和 patch 回调的请求级工具 |
| `create-tools/build-tools.ts` | Create 能力白名单装配 |
| `topic-tools/agent-tools.ts` | 注入当前 topic、actor、数据范围和 patch 回调的请求级工具 |
| `topic-tools/build-tools.ts` | Topic 能力白名单装配 |
| `tool-assembly.ts` | 合并工具组并拒绝重复工具名 |
| `tool-result.ts` | 统一 JSON 成功/失败序列化 |

`search-articles.ts`、`search-posts-meta.ts`、`search-collection.ts` 和 `github-search.ts` 仍是旧业务契约的实现层；它们不直接暴露给模型。模型侧文章元数据工具名统一为 `search_posts`。

## 能力白名单

| 工具 | Chat | Create | Topic |
| --- | --- | --- | --- |
| `search_articles` | 是 | 否 | 否 |
| `search_posts` | 是 | 是 | 是 |
| `get_post_content` | 否 | 是 | 是 |
| `search_collection` / `github_search` | 是 | 否 | 否 |
| `list_prompt_skills` / `load_prompt_skill_template` | 是 | 是 | 是 |
| `web_search` | 是 | 是 | 是 |
| `read_source_url` | 否 | 否 | 是 |
| `get_current_draft` / `emit_draft_patch` | 否 | 是 | 否 |
| `search_topics` / `get_current_topic` / `emit_topic_patch` | 否 | 否 | 是 |

Prompt Skill 工具虽然共用一份 schema 和执行定义，但按 Agent 绑定静态 scope：Chat 可见 `system/chat`，Create 可见 `system/content/create_agent`，Topic 可见 `system/content/topic_agent`。加载时必须同时满足模板和版本为 `ACTIVE`、类型为 `skill`、scope 获准。

## 安全边界

- `draftId`、`topicId`、`actorUserId`、`scopeUserId` 只通过服务端闭包注入，不进入模型 schema。
- `get_current_draft` 和 `get_current_topic` 只能读取 API 路由已经完成数据权限校验的当前资源。
- `emit_draft_patch` 和 `emit_topic_patch` 只把建议发到前端，用户确认后才应用；草稿 patch 仍保持 `returnDirect`。
- system prompt 中的 `@slug` 必须先从原始模板解析，再渲染运行时草稿、选题和用户上下文，业务内容不能改变 Skill 绑定。
- 所有装配必须经过 `assembleAgentTools()`；同一 Agent 出现重复工具名时立即失败。

## 验证

```bash
pnpm verify:ai-tools
pnpm typecheck
pnpm lint
```

`verify:ai-tools` 会校验三条 Agent 的实际工具矩阵、共享工具对象复用、当前资源工具零参数、草稿 patch 的 `returnDirect` 和重复名称拒绝行为。
