# AI Provider 配置管理设计

> 状态：进行中（Provider + 场景绑定代码已落地，待数据迁移与全场景手动验收）
>
> 说明：本文取代旧的“AI 配置组”方案。旧方案使用 `ai.profile_groups` / `ai.active_profiles` / `ai.fallback_profiles` 存在 `tb_config`，现在改为 Provider + Binding 独立表。

## 背景

旧配置组把每个场景的 `api_key`、`base_url`、`model`、温度等字段完整存一份。同一个供应商在 `chat`、`ai_text`、`description`、`create_agent` 等场景中会重复维护，密钥或网关变更时容易漏改。

新方案引入 Provider 抽象：

- Provider 只维护一次 `base_url`、`api_key` 和可用模型列表。
- 场景绑定选择一个 Provider、一个模型和场景专属参数。
- 每个场景激活一条绑定，运行时继续通过 `getAIConfig(scenario)` 读取。

## 数据模型

新增表位于 `prisma/schema/ai.prisma`。

| 表 | 作用 |
| --- | --- |
| `tb_ai_provider` | AI 供应商，保存 `name`、`base_url`、`api_key`、`models`、状态和备注 |
| `tb_ai_scenario` | 自定义场景定义；内置场景由 `src/lib/ai-scenarios.ts` 提供 |
| `tb_ai_scenario_binding` | 场景到 Provider + 模型 + 参数的绑定，每个场景应用层保证只有一条 active |

Provider 删除会级联删除关联绑定。运行时缓存只按场景缓存 5 分钟，Provider 或 Binding 写操作必须清理 `clearAIConfigCache()`。

## 覆盖范围

| 场景 | 使用位置 | 场景专属字段 |
| --- | --- | --- |
| `chat` | `/chat` 对话、Chat Agent、会话标题生成 | `temperature`, `max_tokens` |
| `ai_text` | Markdown 编辑器润色、扩写、摘要 | `temperature`, `max_tokens` |
| `description` | 文章描述生成 | `temperature`, `max_tokens` |
| `create_agent` | 草稿库创作助手 `/create/drafts/[id]` | `temperature`, `max_tokens` |
| `embedding` | 文章向量化、向量搜索、RAG 检索 | `dimensions` |
| `image_gen` | 后台图片生成、图片任务重试、MCP 图片生成 | `api_mode` |
| `tts` | MiMo TTS 语音合成 | `voice` |

Qdrant 的 `qdrant.*` 是向量数据库连接配置，不属于大模型 Provider 管理范围，仍保留在单项配置。

## 运行时读取

`src/lib/ai-config.ts` 仍是统一入口：

1. `getAIConfig(scenario)` 读取该场景 `is_active=true` 的绑定，join Provider 得到 `base_url` 和 `api_key`。
2. `getAIConfigCandidates(scenario)` 返回该场景所有绑定，激活项排在前面；图片生成用它做候选重试。
3. 缺少 active 绑定、Provider 字段或模型时直接抛出明确错误。
4. Provider 更新、Provider 删除、Binding 新建/更新/删除、Binding 激活后都需要清理运行时缓存。

旧的 `tb_config` JSON profile 不再作为运行时回退来源。

## 后台管理

`/c/config` 使用三个 Tab：

| Tab | 作用 |
| --- | --- |
| 单项配置 | 原 `tb_config` key-value CRUD，继续维护非模型类配置 |
| AI 供应商 | 管理 Provider 的 Base URL、API Key、模型清单、启停状态 |
| 场景绑定 | 按场景创建、编辑、激活和删除 Provider 绑定 |

AI Lab 不再有独立 `/c/ai-lab/config` 页面。AI Lab 首页的配置入口跳转到 `/c/config`。

## API

| 路由 | 方法 | 权限 | 说明 |
| --- | --- | --- | --- |
| `/api/config/ai/providers` | GET | `config:view` | 获取 Provider 列表 |
| `/api/config/ai/providers` | POST | `config:edit` | 创建 Provider |
| `/api/config/ai/providers/[id]` | PUT | `config:edit` | 更新 Provider 并清缓存 |
| `/api/config/ai/providers/[id]` | DELETE | `config:edit` | 删除 Provider 并清缓存 |
| `/api/config/ai/providers/[id]/fetch-models` | POST | `config:edit` | 调 OpenAI 兼容 `/models` 拉取模型清单 |
| `/api/config/ai/bindings` | GET | `config:view` | 获取场景绑定列表和场景元数据 |
| `/api/config/ai/bindings` | PUT | `config:edit` | 创建或更新绑定并清缓存 |
| `/api/config/ai/bindings/[id]/activate` | POST | `config:edit` | 激活绑定并清缓存 |
| `/api/config/ai/bindings/[id]` | DELETE | `config:edit` | 删除绑定并清缓存 |
| `/api/config/ai/scenarios` | GET | `config:view` | 获取内置 + 自定义场景 |
| `/api/config/ai/scenarios` | POST | `config:edit` | 创建自定义场景 |

所有管理 GET 响应带 `Cache-Control: no-store`，避免后台看到旧配置。

## 数据迁移

一次性脚本：`scripts/migrate-ai-config-to-provider.ts`。

脚本读取旧 `ai.profile_groups` / `ai.active_profiles` / `ai.fallback_profiles`，按 `base_url` 去重生成 Provider，把每个旧 profile 迁移为一条 Binding，并将旧 active profile 转成 `is_active=true`。迁移完成后删除旧 3 个 JSON key。

脚本只负责历史数据迁移；业务运行时不再读取旧 JSON key。

## 验收

- `/c/config` 能创建 Provider、手动维护模型、一键拉取模型。
- 7 个内置场景都能创建绑定并激活。
- 修改 Provider 的 `api_key` 或 `base_url` 后，关联场景立即读到新配置。
- `/chat`、文章描述、编辑器 AI、向量化、图片生成、TTS、创作 Agent 至少各跑通一次。
- `tb_config` 中旧 3 个 JSON key 迁移后无残留。
