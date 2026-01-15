# AI 模型配置迁移说明

## 概述

项目已将 AI 模型配置从环境变量迁移到数据库，使用业务场景前缀的 key 命名规范。

## 配置 Key 设计

### 1. AI 文本处理（Markdown 编辑器：润色/扩写/摘要）
- `ai_text.api_key` - API 密钥
- `ai_text.model` - 模型名称（如：qwen3-8b, glm-4.5-air）
- `ai_text.base_url` - API 基础 URL
- `ai_text.temperature` - 温度参数（可选，默认 0.7）
- `ai_text.max_tokens` - 最大 token 数（可选，默认 2000）

### 2. 文章描述生成
- `description.api_key` - API 密钥
- `description.model` - 模型名称
- `description.base_url` - API 基础 URL
- `description.temperature` - 温度参数（可选，默认 0.9）
- `description.max_tokens` - 最大 token 数（可选，默认 1000）

### 3. 对话/Chat（ReAct Agent）
- `chat.api_key` - API 密钥
- `chat.model` - 模型名称
- `chat.base_url` - API 基础 URL
- `chat.temperature` - 温度参数（可选，默认 0.7）
- `chat.max_tokens` - 最大 token 数（可选，默认 2000）

### 4. 向量嵌入（Embedding）
- `embedding.api_key` - API 密钥
- `embedding.model` - 模型名称（如：BAAI/bge-large-zh-v1.5）
- `embedding.base_url` - API 基础 URL
- `embedding.dimensions` - 向量维度（可选，默认 1024）

## 批量添加配置

### 方法 1：使用浏览器脚本（推荐）

1. 登录系统并打开配置管理页面：`http://your-domain/c/config`
2. 打开浏览器开发者工具（F12）
3. 复制 `scripts/batch-add-ai-configs.js` 的内容
4. 在控制台（Console）中粘贴并运行
5. 根据提示输入 API Key 和 Base URL（如果脚本中未填写）
6. 等待所有配置添加完成

### 方法 2：手动添加

在配置管理页面（`/c/config`）逐个添加上述配置项。

### 方法 3：使用 API

```bash
# 示例：添加 chat.api_key
curl -X POST http://your-domain/api/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "key": "chat.api_key",
    "title": "对话/Chat - API密钥",
    "value": "your-api-key-here",
    "remark": "用于聊天对话功能（ReAct Agent）",
    "status": 1
  }'
```

## 向后兼容

如果数据库配置不存在，系统会自动回退到环境变量：

- `chat.*` → `SILICONFLOW_API_KEY`, `SILICONFLOW_BASE_URL`, `SILICONFLOW_FREE_QWEN`
- `embedding.*` → `BLOG_EMBEDDING_API_KEY`, `BLOG_EMBEDDING_BASE_URL`, `BLOG_EMBEDDING_MODEL`

**建议**：迁移完成后，可以逐步移除环境变量，完全依赖数据库配置。

## 配置缓存

配置读取使用内存缓存（5 分钟 TTL），避免频繁查询数据库。如需清除缓存，可以重启应用。

## 代码变更

### 新增文件
- `src/lib/ai-config.ts` - 配置读取工具函数

### 修改文件
- `src/lib/ai.ts` - 改为从数据库读取配置
- `src/services/ai/text/index.ts` - 改为使用 OpenAI + LangChain，从数据库读取
- `src/services/ai/description/index.ts` - 改为使用 OpenAI + LangChain，从数据库读取
- `src/services/embedding/embedding.ts` - 从数据库读取配置
- `src/services/vector/embedding.ts` - 从数据库读取配置
- `src/app/api/chat/route.ts` - 使用新的配置读取方式

## 注意事项

1. **必需配置**：每个场景的 `api_key`、`model`、`base_url` 是必需的
2. **可选配置**：`temperature`、`max_tokens`、`dimensions` 有默认值，可以不配置
3. **模型切换**：修改数据库中的 `model` 和 `base_url` 即可快速切换模型
4. **多场景支持**：不同场景可以使用不同的模型和 API，互不影响

## 支持的模型

- **Qwen3 8B**: `qwen3-8b`（SiliconFlow）
- **GLM 4.5 Air**: `glm-4.5-air`（SiliconFlow）
- **其他兼容 OpenAI API 的模型**：只需配置正确的 `base_url` 和 `model` 名称

## 故障排查

1. **配置不存在错误**：检查数据库 `tb_config` 表中是否有对应的配置项
2. **API 调用失败**：检查 `api_key` 和 `base_url` 是否正确
3. **模型不存在**：确认 `model` 名称在对应的 API 服务中有效
4. **缓存问题**：重启应用清除缓存，或等待 5 分钟缓存过期
