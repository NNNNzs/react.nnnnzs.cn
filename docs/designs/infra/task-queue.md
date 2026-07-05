# 后台任务队列系统

> **状态**: 已实施
> **创建日期**: 2026-06-30
> **实现文件**: `src/services/queue/task-queue.ts`
> **相关文档**: [向量化队列](vector/queue.md) | [AI 图片生成](image-gen.md)

## 概述

后台任务队列是项目的通用内存队列基础设施，用于承载耗时、可异步执行、需要状态追踪的后台任务。当前已接入两个业务适配器：

- `src/services/embedding/embedding-queue.ts`: 文章向量化任务。
- `src/services/image-gen-job.ts`: AI 图片生成任务。

`TaskQueue` 本身不关心业务状态表，也不直接访问数据库。它只负责内存态调度、去重、并发控制、重试和状态快照。每个业务适配器负责把任务状态持久化到自己的表里。

## 核心职责

`TaskQueue` 提供以下通用能力：

- 按 `priority` 和 `addTime` 排序，数字越小优先级越高。
- 使用任务 `id` 去重，避免同一任务同时位于等待队列和处理中集合。
- 使用 `concurrency` 控制并发 worker 数量。
- 使用 `maxRetries` 和 `retryDelay` 执行自动重试。
- 通过 `getStatus()` 暴露 `queueLength`、`processingCount`、等待任务、处理中任务和运行状态。

业务适配器负责以下内容：

- 定义任务 payload。
- 在入队前或入队后写入业务状态。
- 在处理成功、失败、重试时更新业务表。
- 在服务重启时根据业务表恢复可恢复任务。

## 数据结构

```typescript
export interface QueueTask<TType extends string = string, TPayload = unknown> {
  id: string;
  type: TType;
  payload: TPayload;
  title?: string;
  priority: number;
  addTime: number;
}

export interface QueueStatusSnapshot {
  queueLength: number;
  processingCount: number;
  queueTasks: QueueTaskSnapshot[];
  processingTasks: string[];
  isRunning: boolean;
}
```

## 当前接入模块

| 模块 | 适配文件 | 持久化状态 | 任务 ID |
| --- | --- | --- | --- |
| 向量化 | `src/services/embedding/embedding-queue.ts` | `tb_post.rag_status` | `postId` |
| 图片生成 | `src/services/image-gen-job.ts` | `tb_image_gen_log.status` | `job_id` |

## 图片生成队列约定

图片生成任务使用 `tb_image_gen_log.job_id` 作为外部任务 ID 和队列任务 ID。`job_id` 由业务服务用 `crypto.randomUUID()` 显式生成（schema 的 `@default(uuid())` 仅作 DB 兜底），不再依赖数据库 `SELECT UUID()` 或 `uuid` 包。

创建流程（单次写入，保证原子性）：

1. 应用层 `crypto.randomUUID()` 生成 `job_id`。
2. 基于 `job_id` 计算 `cos_key`（`/upload/image-gen/{jobId}.png`）与 `reserved_cdn_url`。
3. 单次 `create` 写入 `job_id`、`cos_key`、`reserved_cdn_url` 等全部字段。
4. 将同一个 `job_id` 加入 `TaskQueue`。

状态流转：

| 状态 | 说明 |
| --- | --- |
| `PENDING` | 已持久化并等待内存队列处理 |
| `PROCESSING` | worker 已抢占任务，正在调用模型或转存 CDN |
| `SUCCESS` | 图片生成并转存成功 |
| `FAILED` | 模型调用、下载或 COS 上传失败 |

## 启动恢复

应用启动时，`src/instrumentation.ts` 只在 `NEXT_RUNTIME=nodejs` 时启动图片生成队列并恢复任务：

- 残留 `PROCESSING` 任务标记为 `FAILED`，错误信息写为服务重启中断。
- 残留 `PENDING` 且存在 `job_id` 的任务重新加入内存队列。
- 最近一次恢复摘要保存在进程内，供 `/api/image-gen/queue` 和 `/c/queue` 展示。

向量化队列目前仍按自身业务触发入口入队，状态记录在 `tb_post`。

## 监控与重试

`/c/queue` 是后台任务监控入口，展示向量化和图片生成两个适配器的队列状态。

| 接口 | 权限 | 说明 |
| --- | --- | --- |
| `GET /api/post/embed/queue` | 登录用户 | 向量化内存队列状态 |
| `GET /api/image-gen/queue` | `queue:view` | 图片生成状态统计、等待/处理中任务、最近失败任务、stale 恢复结果 |
| `POST /api/image-gen/jobs/[jobId]/retry` | `image:view` | 先重新入队失败图片任务（幂等去重），再重置为 `PENDING` |

手动重试只允许 `FAILED` 图片任务，且复用原始 `job_id`、prompt、编辑图片、尺寸和质量参数，避免产生新的外部任务标识。入队在前、DB 重置在后，避免入队失败时遗留无人处理的 `PENDING` 孤儿。

## 运行时边界

队列 worker、Prisma、COS 上传、图片转存等能力依赖 Node.js runtime。相关 API route 应显式声明：

```typescript
export const runtime = 'nodejs';
```

`instrumentation.ts` 必须在 `NEXT_RUNTIME=nodejs` 分支内动态加载业务队列，避免 Edge instrumentation 静态分析时引入 Node-only 模块。

## 后续改进

当前 `TaskQueue` 是进程内内存队列，适合单实例或低并发后台任务。若后续需要多实例可靠消费，可以把通用接口迁移到 Redis / BullMQ，同时保留业务适配器的状态表语义。
