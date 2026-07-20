# MCP Prompt 动态注册改造

## 状态

🔄 进行中（代码改造与静态检查已完成，待真实 MCP 客户端联调）

## 背景

AI Lab 模板过去区分 `prompt` 与 `skill`，并把 Skill 通过 `blog://skills` Resource 暴露给 MCP。两套概念和两条加载链路增加了维护成本，也没有使用 MCP 的 Prompt 原语表达“用户可选择的提示词模板”。

本次改造把所有 AI Template 统一为 `prompt`，Agent 仍可按 scope 查询和按需加载正文；MCP 则只暴露后台明确开启的 Prompt。

## 核心决策

1. `TbAiTemplate.type` 只允许 `prompt`，不再用类型区分系统提示词与按需加载指南。
2. Agent 工具统一为 `list_prompts` 和 `load_prompt_template`，Chat/Create/Topic 继续使用各自的 scope 白名单。
3. MCP 使用 `server.registerPrompt`，不再注册 `blog://skills` 和 `blog://skills/{slug}` Resource。
4. 只有 `metadata_json.mcpExposed === true`、模板状态为 `ACTIVE` 且当前版本为 `ACTIVE` 的模板会被注册。
5. MCP Prompt 获取回调返回标准 `GetPromptResult`：`messages[].content` 使用 `{ type: "text", text }`。
6. 注册和正文加载复用 `src/services/ai-template`，不在 MCP Route 中复制 Prisma 查询。

## 实现结构

```text
src/services/ai-template/index.ts
├── listActivePrompts(policy)
└── loadActivePrompt(input)

src/services/mcp/register-mcp-prompts.ts
└── registerMcpPrompts(server, ensureAuth)

src/app/api/mcp/route.ts
└── await registerMcpPrompts(server, ensureAuth)
```

后台 AI Lab Prompt 管理页提供“MCP 暴露”开关，创建和编辑时合并写入模板级 `metadata_json`；版本级 metadata 不承担暴露控制。

## 已完成

- [x] 将 `skill` 类型合并到 `prompt`，并确认数据库遗留 `type=skill` 为 0 行。
- [x] 重命名服务、策略、Agent 工具和兼容映射。
- [x] 将 MCP Skill Resource 注册器替换为 MCP Prompt 注册器。
- [x] 后台移除类型筛选与类型编辑，增加 `mcpExposed` 开关。
- [x] 同步 schema、API descriptor、目录规范与 AI 设计文档。
- [x] 通过 TypeScript 和定向 ESLint 检查。

## 待验收

- [ ] 使用真实 MCP 客户端调用 `prompts/list`，只看到 `mcpExposed=true` 的 ACTIVE Prompt。
- [ ] 调用 `prompts/get`，正文与 AI Lab 当前激活版本一致。
- [ ] 关闭“MCP 暴露”或归档模板后，新请求中的 `prompts/list` 不再返回该 Prompt。
- [ ] 未认证请求继续返回现有 OAuth / Bearer 认证错误。
- [ ] Create / Topic / Chat Agent 的 `list_prompts` 与 `load_prompt_template` 运行行为不回退。

## 风险与约束

- MCP Server 当前按请求创建，因此后台开关或版本激活在下一次 MCP 请求生效。
- `mcpExposed` 在 JavaScript 侧过滤，避免依赖不同数据库对 Prisma JSON path 的兼容差异。
- 数据库中若将来再次出现非 `prompt` 类型，应先迁移数据，再收紧数据库列约束。
