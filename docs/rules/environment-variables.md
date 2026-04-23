
# 环境变量配置

## 命名规范

### 服务端变量
格式：`VARIABLE_NAME`
- 仅在服务端可访问
- 用于数据库、API 密钥等敏感信息

### 客户端变量
格式：`NEXT_PUBLIC_VARIABLE_NAME`
- 在浏览器中暴露
- 用于站点 URL、公共 CDN 等

## 必需环境变量

### 数据库配置
```bash
DATABASE_URL="mysql://user:password@host:port/database"
```

### Redis 配置
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### GitHub OAuth
```bash
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=
```

### 微信登录
```bash
WECHAT_CORP_ID=
WECHAT_AGENT_ID=
WECHAT_SECRET=
```

### 腾讯 COS (文件上传)
```bash
SecretId=your-cos-secret-id
SecretKey=your-cos-secret-key
Bucket=your-bucket-name
Region=ap-shanghai
CDN_URL=https://static.your-domain.com
```

> **双重命名支持**：代码同时支持 `COS_` 前缀命名（`COS_SECRET_ID`、`COS_SECRET_KEY`、`COS_BUCKET`、`COS_REGION`、`COS_CDN_URL`），优先使用无前缀的变量名。

### AI 服务（已迁移至数据库）⚠️ 重要变更

**旧方式**（已废弃）：
```bash
# ❌ 不再使用这些环境变量进行 AI 配置
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...
BLOG_EMBEDDING_API_KEY=sk-...
```

**新方式**（推荐）：
- AI 模型配置已迁移到数据库 `tb_config` 表
- 支持的场景：`chat`、`embedding`、`ai_text`、`description`
- 配置格式：`{scenario}.{config_key}`（如 `chat.api_key`）
- 在系统配置管理页面添加 AI 配置
- 或使用 `scripts/batch-add-ai-configs.js` 批量添加
- 参考 `scripts/README-AI-CONFIG.md`

**配置读取机制**（`src/lib/ai-config.ts`）：
1. 从数据库 `tb_config` 表读取对应场景的配置
2. 内存缓存 5 分钟 TTL
3. 验证必需配置（api_key、model）存在性

**例外**：Anthropic 官方 SDK（`src/services/ai/anthropic/client.ts`）仍直接读取环境变量：
```bash
# 以下环境变量仍被 Anthropic SDK 使用
ANTHROPIC_AUTH_TOKEN=sk-...
ANTHROPIC_BASE_URL=https://...
```

**配置方式说明**：
1. 通过管理后台配置页面添加 AI 模型（推荐）
2. 使用数据库脚本批量添加配置
3. Anthropic SDK 例外：仍需配置环境变量

### Qdrant 向量数据库（已迁移至数据库）⚠️ 重要变更

**旧方式**（已废弃）：
```bash
# ❌ 不再推荐使用这些环境变量
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-api-key
```

**新方式**（推荐）：
- Qdrant 配置已迁移到数据库 `tb_config` 表
- 在系统配置管理页面添加以下配置：
  - `qdrant.url`: Qdrant 服务地址（如 http://localhost:6333）
  - `qdrant.api_key`: API 密钥（可选）
  - `qdrant.timeout`: 超时时间（可选，默认 30000 毫秒）
- 或使用 `pnpm run config:add-vector-db` 批量添加配置模板

**保留的环境变量**（作为后备配置）：
```bash
# 如果数据库中没有配置，会回退到这些环境变量
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-api-key
QDRANT_TIMEOUT=30000
```

**配置方式说明**：
1. 通过管理后台配置页面添加 Qdrant 配置（推荐）
2. 使用脚本添加配置模板：`pnpm run config:add-vector-db`
3. 环境变量作为后备配置，确保兼容性

### 站点配置
```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 配置文件

### 开发环境
复制 `.env.example` 到 `.env`：
```bash
cp .env.example .env
```

### 生产环境
在部署平台配置环境变量，或使用 `.env.production`（注意不要提交到版本控制）。

## 安全注意事项

⚠️ **重要**：
- 永远不要将包含真实密钥的 `.env` 文件提交到 Git
- `.env.local` 和 `.env.production` 已在 `.gitignore` 中
- 仅提交 `.env.example` 作为模板
- 生产环境使用平台的环境变量配置功能
