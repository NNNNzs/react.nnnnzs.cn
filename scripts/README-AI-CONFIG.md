# AI 模型配置迁移说明

## 概述

AI 模型配置已经从“环境变量 / `tb_config` 散 key”迁移为 Provider + 场景绑定模型。

当前入口：

- `/c/config` -> `AI 供应商`：维护 Base URL、API Key、可用模型清单。
- `/c/config` -> `场景绑定`：为每个场景选择 Provider、模型和场景参数。
- `scripts/db/migrate-ai-config-to-provider.ts`：一次性把旧 `ai.profile_groups` 数据迁移到新表。

## 当前数据模型

| 表 | 作用 |
| --- | --- |
| `tb_ai_provider` | 供应商，保存 `base_url`、`api_key`、`models` |
| `tb_ai_scenario_binding` | 场景绑定，保存 `scenario`、`provider_id`、`model`、场景参数和 `is_active` |
| `tb_ai_scenario` | 自定义场景 |

运行时统一通过 `src/lib/ai-config.ts` 读取：

- `getAIConfig(scenario)`：读取当前 active binding。
- `getAIConfigCandidates(scenario)`：读取当前场景全部候选 binding，active 在前。

## 内置场景

| 场景 | 用途 | 场景参数 |
| --- | --- | --- |
| `chat` | `/chat`、Chat Agent、标题生成 | `temperature`, `max_tokens` |
| `ai_text` | 编辑器 AI 文本处理 | `temperature`, `max_tokens` |
| `description` | 文章描述生成 | `temperature`, `max_tokens` |
| `create_agent` | 草稿库创作助手 | `temperature`, `max_tokens` |
| `embedding` | 向量化和 RAG 检索 | `dimensions` |
| `image_gen` | 图片生成 | `api_mode` |
| `tts` | 语音合成 | `voice` |

## 历史迁移

旧版配置使用以下 `tb_config` JSON key：

- `ai.profile_groups`
- `ai.active_profiles`
- `ai.fallback_profiles`

迁移命令：

```bash
pnpm tsx scripts/db/migrate-ai-config-to-provider.ts
```

脚本会按 `base_url` 去重生成 Provider，并把旧 profile 迁移成场景绑定。迁移完成后会删除旧 3 个 JSON key。

## 缓存

`getAIConfig()` 对场景配置做 5 分钟内存缓存。Provider 或 Binding 变更后，相关 API 会调用 `clearAIConfigCache()`，使运行时立即读取新配置。

## 注意事项

1. Provider 的 API Key 目前仍明文存储，与旧 `tb_config` 方案一致。
2. 一键拉取模型只支持 OpenAI 兼容 `/models` 接口，失败时手动维护模型名。
3. 新业务场景优先在 `src/lib/ai-scenarios.ts` 注册内置场景；临时场景可在后台新增自定义场景。
4. 旧 `chat.api_key`、`embedding.api_key`、`image_gen.api_key` 等散 key 不再作为运行时回退来源。
