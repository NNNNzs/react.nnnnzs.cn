# AI 图片生成功能设计文档

## 概述

在管理后台新增「AI 图片生成」页面，调用 GPT Image 2 模型（通过 micuapi.ai 中转站），支持文生图和图文编辑。图片生成统一走异步队列：接口先返回任务 ID 和预分配 CDN URL，后台队列完成生成、转存和状态更新。

## API 信息

- **上游端点:** 支持 `https://www.micuapi.ai/v1/chat/completions` 和 OpenAI 兼容的 `/v1/images/generations`
- **模型:** `gpt-image-2`
- **认证方式:** `Authorization: Bearer $API_KEY`
- **返回格式:** 图片 URL（OSS 托管，非 base64）

### 文生图

```json
{
  "model": "gpt-image-2",
  "messages": [{ "role": "user", "content": "描述文字" }]
}
```

### 图文编辑

```json
{
  "model": "gpt-image-2",
  "messages": [{ "role": "user", "content": [
    { "type": "text", "text": "编辑指令" },
    { "type": "image_url", "image_url": { "url": "https://..." } }
  ]}]
}
```

### 响应

content 中包含 markdown 图片链接 `![image](https://oss.filenest.top/uploads/xxx.png)`，通过正则提取。

### Images Generations 模式

当后台配置 `image_gen.api_mode=images_generations` 时，请求使用 OpenAI 图片生成接口格式：

```json
{
  "model": "gpt-image-2",
  "prompt": "描述文字",
  "n": 1,
  "size": "1024x1024",
  "quality": "high"
}
```

响应支持 `data[0].url` 和 `data[0].b64_json` 两种格式。`b64_json` 会先转存到 CDN，再返回 CDN URL。

> 注意：`images_generations` 仅支持文生图；图文编辑继续使用 `chat_completions` 模式。

## 系统配置

| 配置 Key | 说明 | 示例值 |
|----------|------|--------|
| `image_gen.api_key` | API 密钥 | `sk-xxx` |
| `image_gen.base_url` | 基础地址 | `https://www.micuapi.ai` |
| `image_gen.model` | 模型名 | `gpt-image-2` |
| `image_gen.api_mode` | 接口模式：`chat_completions` 或 `images_generations` | `chat_completions` |

## 文件结构

```
src/services/
├── image-gen.ts                # 图片生成 service（核心逻辑）
├── image-gen-job.ts            # 图片生成异步任务（UUID jobId + 队列）
└── queue/task-queue.ts         # 通用后台任务队列
src/app/api/image-gen/
├── route.ts                    # POST: 创建图片生成任务
└── jobs/[jobId]/route.ts       # GET: 查询图片生成任务状态
src/lib/
└── api-registry.ts             # MCP 工具注册（handler 引用任务 service）
src/app/c/image-gen/
└── page.tsx                    # 图片生成页面
src/components/ImageGen/
├── ImageGenPanel.tsx           # 参数配置面板
└── ImageResultCard.tsx         # 结果展示组件
```

## MCP 工具

已注册为 MCP 工具 `generate_image`，支持 Claude 等 AI 客户端提交图片生成任务。工具会立即返回 `jobId`、预分配 `imageUrl` 和 `resourceUri`，不等待上游图片模型完成。

- **工具名**: `generate_image`
- **权限**: `image:view`
- **输入参数**: prompt、size、quality
- **状态资源**: `blog://image-generation-jobs/{jobId}`

MCP 状态查询使用 `ResourceTemplate`，客户端读取 `generate_image` 返回的 `resourceUri` 即可获得当前任务状态、最终 CDN URL、错误信息和耗时。

## API 设计

### POST /api/image-gen

**权限:** 仅 admin，支持 LTK 长期 Token

**请求体:**
```typescript
interface ImageGenRequest {
  mode: 'generate' | 'edit';  // 模式
  prompt: string;              // 提示词（必填）
  image?: string;              // 参考图 URL（edit 模式必填）
  size?: string;               // 尺寸，如 1024x1024
  quality?: string;            // 质量：high | medium
}
```

**响应:** `202 Accepted`
```json
{
  "status": true,
  "message": "图片生成任务已提交",
  "data": {
    "jobId": "2d7d8a1f-7c6b-4b3a-9b62-5a4a1f8b97d1",
    "status": "PENDING",
    "ready": false,
    "imageUrl": "https://static.nnnnzs.cn/upload/image-gen/2d7d8a1f-7c6b-4b3a-9b62-5a4a1f8b97d1.png",
    "cosKey": "/upload/image-gen/2d7d8a1f-7c6b-4b3a-9b62-5a4a1f8b97d1.png",
    "resourceUri": "blog://image-generation-jobs/2d7d8a1f-7c6b-4b3a-9b62-5a4a1f8b97d1",
    "statusUrl": "/api/image-gen/jobs/2d7d8a1f-7c6b-4b3a-9b62-5a4a1f8b97d1"
  }
}
```

### GET /api/image-gen/jobs/[jobId]

**权限:** `image:view`

返回任务状态，状态值包括：

| 状态 | 说明 |
|------|------|
| `PENDING` | 已入队，等待处理 |
| `PROCESSING` | 后台队列正在调用模型或转存图片 |
| `SUCCESS` | 已生成并上传到预分配 CDN URL |
| `FAILED` | 生成或上传失败，`errorMessage` 包含失败原因 |

响应头必须包含 `Cache-Control: no-store`，避免 CDN 或代理缓存实时任务状态。
