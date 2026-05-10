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
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_mysql_password
DB_DATABASE=blog
DATABASE_URL="mysql://root:your_mysql_password@localhost:3306/blog"
```

> **说明**：
> - `DB_*` 变量用于迁移脚本
> - `DATABASE_URL` 用于 Prisma ORM
> - 两者数据库名必须保持一致

### Redis 配置
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=1
```

### 应用配置
```bash
NODE_ENV=development
PORT=3000
JWT_SECRET=your-secret-key-here-change-in-production
```

### GitHub OAuth
```bash
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/github/callback
```

### 微信登录
```bash
WECHAT_CORP_ID=
WECHAT_AGENT_ID=
WECHAT_SECRET=
```

### 微信小程序
```bash
WX_APP_ID=your-wechat-app-id
WX_APP_SECRET=your-wechat-app-secret
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

### 腾讯云人脸识别（IAI）
```bash
TENCENT_IAI_REGION=ap-shanghai
FACE_GROUP_ID=blog_users
```

> **说明**：
> - `TENCENT_IAI_REGION`：腾讯云 IAI 服务区域，默认 `ap-shanghai`
> - `FACE_GROUP_ID`：腾讯云人员库 GroupId，需在腾讯云控制台手动创建
> - 认证凭据复用腾讯云 COS 的 `SecretId` 和 `SecretKey` 环境变量

### 站点配置
```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Docker 部署配置（可选）
```bash
DOCKER_HUB_TOKEN=your-docker-hub-token
DOCKERHUB_USERNAME=your-dockerhub-username
```

## 已迁移至数据库的配置

以下配置已从环境变量迁移到数据库 `tb_config` 表，通过**系统配置管理页面**配置：

### AI 服务配置
- 聊天模型（`chat.api_key`, `chat.model` 等）
- 向量化模型（`embedding.api_key`, `embedding.model` 等）
- AI 文本生成（`ai_text.*`）
- 描述生成（`description.*`）

详见：[scripts/README-AI-CONFIG.md](../../scripts/README-AI-CONFIG.md)

### Qdrant 向量数据库
- `qdrant.url`：Qdrant 服务地址
- `qdrant.api_key`：API 密钥
- `qdrant.timeout`：超时时间

**后备环境变量**（可选）：
```bash
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-qdrant-api-key
QDRANT_TIMEOUT=30000
```

### TTS 语音合成
- `tts.api_key`：MiMo API 密钥
- `tts.base_url`：API 基地址
- `tts.default_model`：默认模型
- `tts.default_voice`：默认音色

详见：[TTS 功能设计](../designs/tts-page.md)

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
