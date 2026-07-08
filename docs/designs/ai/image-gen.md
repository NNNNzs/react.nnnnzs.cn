# AI 图片生成功能设计文档

## 概述

在管理后台新增「AI 图片生成」页面，调用 GPT Image 2 模型（通过 micuapi.ai 中转站），支持文生图和图文编辑。图片生成统一走异步队列：接口先返回任务 ID 和预分配 CDN URL，后台队列完成生成、转存和状态更新。

## API 信息

- **上游端点:** 支持 `https://www.micuapi.ai/v1/chat/completions` 和 OpenAI 兼容的 `/v1/images/generations`、`/v1/images/edits`
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

### Images API 模式

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

图文编辑模式会自动改用 OpenAI 兼容的 `/v1/images/edits`，以 `multipart/form-data` 上传一张或多张参考图：

```text
model=gpt-image-2
prompt=编辑指令
image[]=@reference-1.png
image[]=@reference-2.png
size=1024x1024
quality=high
```

## 系统配置

图片生成配置在 `/c/config` 统一维护：

| 位置 | 说明 |
|----------|------|
| AI 供应商 | 维护 API Key、Base URL 和可用模型清单 |
| 场景绑定 `image_gen` | 选择 Provider、模型和 `api_mode` |
| 运行时 | `getAIConfigCandidates('image_gen')` 返回激活绑定和候选绑定，失败时按顺序尝试 |

## 文件结构

```
src/services/
├── image-gen.ts                # 图片生成 service（核心逻辑）
├── image-gen-job.ts            # 图片生成异步任务（UUID jobId + 队列）
├── cos-client.ts               # COS 共享客户端（getCosClient / getCosBucketConfig）
└── queue/task-queue.ts         # 通用后台任务队列
src/app/api/image-gen/
├── route.ts                    # POST: 创建图片生成任务
├── edit/route.ts               # POST: 创建图片编辑任务
├── jobs/[jobId]/route.ts       # GET: 查询图片生成任务状态
├── jobs/[jobId]/retry/route.ts # POST: 重试失败任务
└── queue/route.ts              # GET: 队列监控快照
src/lib/
├── api-registry.ts             # MCP 工具注册（handler 引用任务 service）
└── uuid.ts                     # UUID 校验工具（UUID_REGEX / isUuid）
src/app/c/image-gen/
└── page.tsx                    # 图片生成页面
src/components/ImageGen/
├── ImageGenPanel.tsx           # 参数配置面板
└── ImageResultCard.tsx         # 结果展示组件
```

## MCP 工具

已注册 MCP 工具 `generate_image` 和 `edit_image`，支持 Claude 等 AI 客户端提交图片生成或图片编辑任务。工具会立即返回 `jobId`、预分配 `imageUrl` 和 `resourceUri`，不等待上游图片模型完成。

- **工具名**: `generate_image`
- **权限**: `image:view`
- **输入参数**: prompt、size、quality
- **状态资源**: `blog://image-generation-jobs/{jobId}`

- **工具名**: `edit_image`
- **权限**: `image:view`
- **输入参数**: prompt、image 或 images、size、quality
- **状态资源**: `blog://image-generation-jobs/{jobId}`

MCP 状态查询使用 `ResourceTemplate`，客户端读取工具返回的 `resourceUri` 即可获得当前任务状态、最终 CDN URL、错误信息和耗时。

## API 设计

### POST /api/image-gen

**权限:** 仅 admin，支持 LTK 长期 Token

**请求体:**
```typescript
interface ImageGenRequest {
  mode: 'generate' | 'edit';  // 模式
  prompt: string;              // 提示词（必填）
  image?: string;              // 单张参考图 URL（兼容旧客户端）
  images?: string[];           // 多张参考图 URL
  size?: string;               // 尺寸，如 1024x1024
  quality?: string;            // 质量：low | medium | high | auto
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

## 后台队列监控与重试

> 通用队列设计详见：[后台任务队列系统](task-queue.md)

> 更新日期：2026-07-01

图片生成已经接入通用后台任务监控 `/c/queue`。该页面展示 `PENDING`、`PROCESSING`、`SUCCESS`、`FAILED` 汇总，当前内存等待队列、处理中任务、最近失败任务，以及启动时 stale 任务恢复结果。

### UUID 来源

`tb_image_gen_log.job_id` 是对外任务 ID，用于 API 查询、MCP resource URI 和队列去重。由业务服务在创建任务前用 `crypto.randomUUID()` 显式生成，连同 `cos_key`、`reserved_cdn_url` 在**单次 `create`** 中一起写入（保证原子性，避免崩溃留下 `cos_key` 为空的 PENDING 行）。schema 的 `@default(uuid())` 仅作为 DB 层兜底。基于该 ID 预分配：

```text
COS Key: /upload/image-gen/{jobId}.png
Resource: blog://image-generation-jobs/{jobId}
Status: /api/image-gen/jobs/{jobId}
```

### 新增接口

#### GET /api/image-gen/queue

权限：`queue:view`

返回图片生成队列监控快照：

- `counts`: `PENDING` / `PROCESSING` / `SUCCESS` / `FAILED` 数量。
- `queue`: 当前进程内 `TaskQueue` 快照。
- `queueTasks`: 等待中的图片生成任务。
- `processingTasks`: 正在处理的图片生成任务。
- `recentFailedTasks`: 最近失败任务，供后台手动重试。
- `staleRecovery`: 当前进程启动时的恢复摘要。

#### POST /api/image-gen/jobs/[jobId]/retry

权限：`image:view`

仅支持重试 `FAILED` 任务。接口先以同一个 `jobId` 重新加入图片生成队列（幂等去重，若已在队列或处理中则拒绝），入队成功后再清理错误信息、重置耗时和时间字段、将状态改回 `PENDING`，避免遗留无人处理的 PENDING 任务。

### 运行时边界

图片生成、文件上传、COS 删除等能力依赖 Node.js、`Buffer`、COS SDK 和 Prisma。相关 API route 显式声明 `runtime = 'nodejs'`。`instrumentation.ts` 也改为在 `NEXT_RUNTIME=nodejs` 分支内动态加载图片生成队列，避免 Edge instrumentation 静态分析时误触 Node-only 模块。
