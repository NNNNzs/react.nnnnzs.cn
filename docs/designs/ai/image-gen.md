# AI 图片工作台设计文档

## 概述

管理后台「AI 图片工作台」提供图片生成与图片识别。图片生成统一走异步队列：接口先返回任务 ID 和预分配 CDN URL，后台队列完成生成、转存和状态更新；是否基于参考图生成由参考图参数自动决定。图片识别调用多模态模型后同步返回文本结果。

`/c/ai-lab/image-gen` 复用该工作台，在「图片生成」与「图片识别」两个页签之间切换。图片生成的参考图为可选输入，尺寸/比例和质量偏好为可自由输入的提示词模板字段；图片识别保留当前标签页的会话历史。

## API 信息

- **上游端点:** 支持 `https://www.micuapi.ai/v1/chat/completions` 和 OpenAI 兼容的 `/v1/images/generations`、`/v1/images/edits`
- **模型:** 由 `image_gen` 场景绑定选择，示例使用 `gpt-image-2`
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

### 图片生成约束

前端公共 `ImageGenerationComposer` 提供可选的尺寸/比例和质量偏好输入，并将非空值写入提示词末尾：

```text
【生成参考】尺寸或比例：16:9；质量偏好：电影感。
```

尺寸和质量不会作为独立 API、队列或上游 Images API 参数传递；输入为空时不追加约束。尺寸可以是像素、比例或自然语言，质量也可以是任意偏好文本。

分组是工作台的通用管理字段：图片生成时写入队列任务 `ext_json.group`，素材库生成时同时写入素材分组。它用于后续筛选、展示与管理，不会传给图片模型。图文编辑的「添加参考图」弹窗与素材库解耦：本地图片上传到 `/upload/image-references/` 并返回 CDN URL、外链直接使用 HTTPS URL，然后 emit 给编辑器参考图列表；不创建素材记录。只有素材库页面的「添加素材」才会入库。

### Images API 模式

当后台配置 `image_gen.api_mode=images_generations` 时，请求使用 OpenAI 图片生成接口格式：

```json
{
  "model": "gpt-image-2",
  "prompt": "描述文字",
  "n": 1
}
```

响应支持 `data[0].url` 和 `data[0].b64_json` 两种格式。`b64_json` 会先转存到 CDN，再返回 CDN URL。

提供参考图时会自动改用 OpenAI 兼容的 `/v1/images/edits`，以 `multipart/form-data` 上传一张或多张参考图：

```text
model=gpt-image-2
prompt=编辑指令
image[]=@reference-1.png
image[]=@reference-2.png
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
├── recognize/route.ts          # POST: 同步识别图片内容
├── references/upload/route.ts  # POST: 上传非素材库参考图，返回 CDN URL
├── jobs/[jobId]/route.ts       # GET: 查询图片生成任务状态
├── jobs/[jobId]/retry/route.ts # POST: 重试失败任务
└── queue/route.ts              # GET: 队列监控快照
src/lib/
├── api-registry.ts             # MCP 工具注册（handler 引用任务 service）
└── uuid.ts                     # UUID 校验工具（UUID_REGEX / isUuid）
src/app/c/image-gen/
└── page.tsx                    # 图片工作台（图片生成 / 图片识别）
src/components/ImageGen/
├── ImageGenerationComposer.tsx # 图片生成公共编排器
├── ImageRecognitionWorkbench.tsx # 图片识别工作区
└── ImageResultCard.tsx         # 结果展示组件
```

### 前端组件复用边界

| 组件 | 职责 | 复用规则 |
|------|------|----------|
| `ImageGenerationComposer` | 图片生成、可选参考图、尺寸/比例、质量偏好、分组与队列提交 | AI Lab 和 `/create/assets` 必须复用，不再各自实现生成表单 |
| `ImageReferenceAddModal` | 上传参考图到专用 COS 路径或填写 HTTPS 外链，确认后仅 emit URL | 图片生成复用；不得写入素材库 |
| `ImageAssetAddModal` | 上传图片或添加外链，并建立 `ContentAsset` 素材记录 | 仅素材库“添加素材”入口使用；成功后 emit 素材记录 |
| `ImageRecognitionWorkbench` | 识别图、提问、识别结果和当前标签页会话历史 | AI 图片工作台的“图片识别”页签使用 |

新增图片相关入口时，应先组合上述组件并通过回调注入业务 API；不要复制上传、参考图预览、队列提交或会话历史逻辑。

## MCP 工具

已注册 MCP 工具 `generate_image`，支持 Claude 等 AI 客户端提交图片生成任务；参考图参数可选，有参考图时自动按图片编辑协议处理。工具会立即返回 `jobId`、预分配 `imageUrl` 和 `resourceUri`，不等待上游图片模型完成。

- **工具名**: `generate_image`
- **权限**: `image:view`
- **输入参数**: prompt；可选 images、group
- **状态资源**: `blog://image-generation-jobs/{jobId}`

- **工具名**: `generate_draft_image`
- **权限**: `content:edit`
- **输入参数**: `draft_id`、`prompt`；可选 `image`、`images`、`title`、`group`
- **行为**: 为指定草稿提交图片生成任务；有参考图时自动基于参考图生成，立即创建素材库记录并关联草稿。草稿会显示预分配 CDN 地址对应的占位素材，任务完成后同一素材记录展示正式图片。
- **推荐对话**: “为草稿《xxx》生成小红书封面并关联到草稿”。
- **状态资源**: `blog://image-generation-jobs/{jobId}`

MCP 状态查询使用 `ResourceTemplate`，客户端读取工具返回的 `resourceUri` 即可获得当前任务状态、最终 CDN URL、错误信息和耗时。

## API 设计

### POST /api/image-gen

**权限:** `image:view`，支持登录态与具备该权限的长期 Token

**请求体:**
```typescript
interface ImageGenRequest {
  prompt: string;              // 提示词（必填）
  image?: string;              // 单张参考图 URL（兼容旧客户端）
  images?: string[];           // 多张参考图 URL
  group?: string;              // 管理分组，不传给模型
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

## 图片识别

### POST /api/image-gen/recognize

图片识别使用 `image_recognition` 场景绑定的 OpenAI 兼容多模态模型，权限为 `image:view`，同步返回中文文本描述。请求提供远程 `imageUrl`，并可传入自定义 `prompt` 与 `detail`（`low`、`auto`、`high`）。

AI Lab 识图使用与图文编辑一致的“添加识别图”弹窗：本地文件上传至参考图存储并返回 CDN URL，外链直接使用 HTTPS URL；两者均不建立素材记录。识图历史仅写入当前标签页的 `sessionStorage`，最多 20 条，并通过抽屉查看。

## 后台队列监控与重试

> 通用队列设计详见：[后台任务队列系统](../infra/task-queue.md)

> 更新日期：2026-07-01

图片生成已经接入通用后台任务监控 `/c/queue`。该页面展示 `PENDING`、`PROCESSING`、`SUCCESS`、`FAILED` 汇总，当前内存等待队列、处理中任务、最近失败任务，以及启动时 stale 任务恢复结果。

### UUID 来源

新任务写入通用表 `tb_ai_job`，并设置 `type='image-gen'`；`tb_image_gen_log` 只通过 `TbImageGenLogLegacy` 保留历史数据。`tb_ai_job.job_id` 是对外任务 ID，用于 API 查询、MCP resource URI 和队列去重。业务服务在创建任务前生成 UUID，并将 `cos_key`、`reserved_cdn_url`、`ext_json` 在单次 `create` 中写入，随后加入内存队列。基于该 ID 预分配：

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
