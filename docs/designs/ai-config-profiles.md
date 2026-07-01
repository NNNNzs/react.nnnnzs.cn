# AI 场景配置组管理设计

> 状态：已实施
>
> 目标：让不同 AI 使用场景各自维护多套模型地址、模型和密钥配置，并支持独立切换；图片生成支持失败后按顺序降级到备用配置。

## 背景

原配置管理通过 `tb_config` 的单项 key 维护，例如 `chat.api_key`、`chat.model`、`image_gen.base_url`。这种方式适合少量固定字段，但在维护多套供应商、网关地址或测试环境时，需要逐项修改，容易漏改。

第一版全局配置组会把 Chat、编辑器 AI、图片生成等所有场景绑成一套。实际运维时，这些场景应独立切换：Chat 可以用一组，编辑器 AI 可以用另一组，图片生成也需要自己的主备策略。

## 存储结构

不新增数据表，继续使用 `tb_config`：

| key | 含义 |
| --- | --- |
| `ai.profile_groups` | 各场景配置组列表和场景定义 JSON |
| `ai.active_profiles` | 各场景当前激活配置组 ID |
| `ai.fallback_profiles` | 支持降级的场景备用配置组 ID 顺序 |

`ai.profile_groups` 的结构：

```json
{
  "version": 1,
  "scenarioMetas": {
    "chat": {
      "label": "Chat 对话",
      "description": "/chat 页面、Chat Agent 和会话标题生成",
      "requiredFields": ["api_key", "model", "base_url"],
      "optionalFields": ["temperature", "max_tokens"]
    },
    "agent_review": {
      "label": "评审 Agent",
      "description": "用于可研报告评审",
      "requiredFields": ["api_key", "model", "base_url"],
      "optionalFields": ["temperature", "max_tokens"]
    }
  },
  "scenarioProfiles": {
    "chat": [
      {
        "id": "chat-main",
        "name": "Chat 主用",
        "description": "主站对话",
        "config": {
          "api_key": "sk-...",
          "model": "mimo-v2.5-pro-ultraspeed",
          "base_url": "https://token-plan-cn.xiaomimimo.com/v1",
          "temperature": "0.7",
          "max_tokens": "2000"
        }
      }
    ],
    "image_gen": [
      {
        "id": "image-gateway",
        "name": "图片网关",
        "config": {
          "api_key": "sk-...",
          "model": "gpt-image-2",
          "base_url": "https://ai-gateway.nnnnzs.cn",
          "api_mode": "images_generations"
        }
      }
    ]
  }
}
```

内置场景会自动补齐到 `scenarioMetas`。后台新增自定义场景时，也会写入 `scenarioMetas`，并与 `chat`、`ai_text` 等内置场景并列。

`ai.active_profiles` 的结构：

```json
{
  "chat": "chat-main",
  "image_gen": "image-gateway"
}
```

`ai.fallback_profiles` 的结构：

```json
{
  "image_gen": ["image-backup"]
}
```

## 覆盖范围

| 场景 | 使用位置 | 字段 |
| --- | --- | --- |
| `chat` | `/chat` 对话、Chat Agent、会话标题生成 | `api_key`, `model`, `base_url`, `temperature`, `max_tokens` |
| `ai_text` | Markdown 编辑器润色、扩写、摘要 | `api_key`, `model`, `base_url`, `temperature`, `max_tokens` |
| `description` | 文章描述生成 | `api_key`, `model`, `base_url`, `temperature`, `max_tokens` |
| `embedding` | 文章向量化、向量搜索、RAG 检索 | `api_key`, `model`, `base_url`, `dimensions` |
| `image_gen` | 后台图片生成、图片任务重试、MCP 图片生成 | `api_key`, `model`, `base_url`, `api_mode` |
| `tts` | MiMo TTS 语音合成 | `api_key`, `model`, `base_url`, `voice` |

Qdrant 的 `qdrant.*` 是向量数据库连接配置，不属于大模型地址切换范围，仍保留原单项配置。

## 运行时读取

`src/lib/ai-config.ts` 的 `getAIConfig(scenario)` 仍是普通场景的统一入口：

1. 读取 `ai.profile_groups` 和 `ai.active_profiles`。
2. 找到当前场景的激活配置组。
3. 校验 `api_key`、`model`、`base_url`。
4. 返回标准 `AIConfig`。

运行时不再回退读取旧的 `scenario.field` 散配置。如果某个场景没有激活配置组，或缺少必填字段，会直接抛出明确错误。

图片生成使用 `getAIConfigCandidates('image_gen')`：

1. 返回图片生成当前激活配置。
2. 追加 `ai.fallback_profiles.image_gen` 中声明的备用配置。
3. `generateImage` 按顺序调用，某个配置失败后自动尝试下一个配置。
4. 全部失败时抛出最后一次错误。

## 后台管理

`/c/config` 的 `AI 配置组` 页签采用场景独立管理：

- 左侧“新增场景”用于创建新的应用场景。
- 左侧选择场景。
- 中间维护当前场景的配置组列表。
- 右侧编辑当前配置组字段。
- “迁移当前”只迁移当前场景的旧散配置。
- “激活”只切换当前场景。
- 图片生成场景额外配置“降级顺序”。

原来的单项配置 CRUD 保留在 `单项配置` 页签，用于继续维护非模型配置或排查旧数据。

## 新增应用场景

如果以后新增一个和 `chat` 并列的场景，例如 `agent_review`：

1. 在 `/c/config` 的 `AI 配置组` 页签点击“新增场景”。
2. 填写场景 Key，例如 `agent_review`。Key 只使用小写字母、数字和下划线，并以字母开头。
3. 填写显示名称、说明、必填字段和可选字段。
4. 在新场景下创建配置组，保存并激活。
5. 业务代码中通过 `getAIConfig('agent_review')` 读取配置。

如果该场景需要像图片生成一样支持主备降级，可以在代码中使用 `getAIConfigCandidates('agent_review')`，并在后台给该场景配置降级顺序。

## API

| 路由 | 方法 | 权限 | 说明 |
| --- | --- | --- | --- |
| `/api/config/ai-profiles` | GET | `config:view` | 读取场景配置组、激活项、降级项、场景元数据和旧散配置迁移草稿 |
| `/api/config/ai-profiles` | PUT | `config:edit` | 保存场景配置组、激活项和降级项 |

GET 响应带 `Cache-Control: no-store`，避免管理后台看到旧配置。
