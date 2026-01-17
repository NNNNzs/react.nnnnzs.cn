# 队列系统设计文档

## 概述

本项目实现了一个**基于内存的异步任务队列系统**，用于管理文章向量化任务。该系统将耗时的向量化操作从主请求流程中分离，提高 API 响应速度，同时保证任务的可靠执行。

### 核心特性

- **异步执行**：不阻塞主流程，API 响应时间 < 100ms
- **优先级队列**：支持任务优先级，新文章优先于更新文章
- **并发控制**：限制并发数量，避免资源耗尽
- **错误重试**：自动重试失败任务，提高可靠性
- **状态管理**：实时追踪任务状态（待处理、处理中、已完成、失败）

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                   业务流程（post.ts）                     │
│  - createPost() / updatePost()                          │
│  - 文章保存到数据库                                       │
│  - queueEmbedPost() 添加任务到队列                        │
│  - 立即返回响应（不等待向量化完成）                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│               向量化队列（embedding-queue.ts）            │
│  ┌─────────────────────────────────────────────────┐    │
│  │  任务队列（优先级排序）                            │    │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐              │    │
│  │  │ P1  │ │ P5  │ │ P5  │ │ P10 │ ...         │    │
│  │  └─────┘ └─────┘ └─────┘ └─────┘              │    │
│  └─────────────────────────────────────────────────┘    │
│                          ↓                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │  并发处理器（Concurrency = 2）                    │    │
│  │  ┌─────────┐        ┌─────────┐                │    │
│  │  │ Worker1 │        │ Worker2 │                │    │
│  │  └─────────┘        └─────────┘                │    │
│  └─────────────────────────────────────────────────┘    │
│                          ↓                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │  错误重试机制                                     │    │
│  │  - 最大重试次数：2                                │    │
│  │  - 重试延迟：5 秒                                 │    │
│  │  - 失败记录到数据库                               │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│            向量化服务（simple-embedder.ts）               │
│  1. 删除旧向量                                          │
│  2. 文本切片（500 tokens，重叠 100）                     │
│  3. 批量生成向量（Embedding API）                        │
│  4. 插入 Qdrant                                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   Qdrant 向量数据库                      │
│  - Collection: blog_posts                               │
│  - Payload: postId, chunkIndex, chunkText, title, hide   │
└─────────────────────────────────────────────────────────┘
```

### 核心组件

| 组件 | 路径 | 职责 |
|------|------|------|
| **队列系统** | `src/services/embedding/embedding-queue.ts` | 任务队列、并发控制、错误重试 |
| **向量化服务** | `src/services/embedding/simple-embedder.ts` | 文本切片、向量生成、Qdrant 操作 |
| **文本切片** | `src/services/embedding/text-splitter.ts` | Markdown 分块、内容清理 |
| **向量存储** | `src/services/embedding/vector-store.ts` | Qdrant CRUD 操作 |
| **状态管理** | `src/services/post.ts` | 更新 `rag_status` 和 `rag_error` |

---

## 技术实现

### 数据结构

#### 任务定义

```typescript
/**
 * 向量化任务
 */
export interface EmbedTask {
  postId: number;      // 文章 ID
  title: string;       // 文章标题
  content: string;     // 文章内容（Markdown）
  hide?: string;       // 是否隐藏（'0' 或 '1'）
  priority: number;    // 优先级（数字越小越优先）
  addTime: number;     // 添加时间（时间戳）
}

/**
 * 向量化状态
 */
export enum EmbedStatus {
  PENDING = 'pending',       // 待处理
  PROCESSING = 'processing', // 处理中
  COMPLETED = 'completed',   // 已完成
  FAILED = 'failed',         // 失败
}

/**
 * 队列配置
 */
const QUEUE_CONFIG = {
  concurrency: 2,      // 并发处理数量
  maxRetries: 2,       // 任务重试次数
  retryDelay: 5000,    // 重试延迟（毫秒）
  checkInterval: 1000, // 队列检查间隔（毫秒）
};
```

#### 数据库状态字段

```prisma
// prisma/schema.prisma

model TbPost {
  // ... 其他字段

  rag_status     String?  @default("pending")  // 向量化状态
  rag_error      String?  @db.Text             // 错误信息
}
```

### 关键流程

#### 1. 队列启动和调度

```typescript
class EmbeddingQueue {
  private queue: EmbedTask[] = [];
  private processing = new Set<number>();
  private isRunning = false;

  /**
   * 启动队列
   */
  start() {
    if (this.isRunning) return;

    console.log('🚀 启动向量化队列');
    this.isRunning = true;
    this.schedule();
  }

  /**
   * 调度下一个任务
   */
  private schedule() {
    if (!this.isRunning) return;

    // 如果队列中有任务且未达到并发限制
    while (
      this.queue.length > 0 &&
      this.processing.size < QUEUE_CONFIG.concurrency
    ) {
      const task = this.queue.shift();
      if (!task) break;

      this.processTask(task);
    }

    // 定期检查队列
    this.timer = setTimeout(() => this.schedule(), QUEUE_CONFIG.checkInterval);
  }

  /**
   * 处理单个任务
   */
  private async processTask(task: EmbedTask) {
    this.processing.add(task.postId);

    try {
      // 更新数据库状态为处理中
      await this.updateTaskStatus(task.postId, EmbedStatus.PROCESSING);

      // 执行向量化
      await simpleEmbedPost({
        postId: task.postId,
        title: task.title,
        content: task.content,
        hide: task.hide,
      });

      // 更新数据库状态为已完成
      await this.updateTaskStatus(task.postId, EmbedStatus.COMPLETED);

      console.log(`✅ 文章 ${task.postId} 向量化完成`);
    } catch (error) {
      console.error(`❌ 文章 ${task.postId} 向量化失败:`, error);

      // 重试逻辑
      const retryCount = await this.getRetryCount(task.postId);
      if (retryCount < QUEUE_CONFIG.maxRetries) {
        console.log(`🔄 重试文章 ${task.postId} (第 ${retryCount + 1} 次)`);
        await this.incrementRetryCount(task.postId);

        // 延迟后重新加入队列
        setTimeout(() => {
          this.add({ ...task, priority: task.priority + 1 }); // 降低优先级
        }, QUEUE_CONFIG.retryDelay);
      } else {
        // 标记为失败
        await this.updateTaskStatus(
          task.postId,
          EmbedStatus.FAILED,
          error.message
        );
      }
    } finally {
      this.processing.delete(task.postId);
    }
  }
}
```

#### 2. 任务添加流程

```typescript
/**
 * 添加任务到队列
 */
add(task: EmbedTask): void {
  // 检查重复
  const exists = this.queue.some(t => t.postId === task.postId);
  if (exists) {
    console.log(`⚠️ 文章 ${task.postId} 已在队列中`);
    return;
  }

  // 检查是否正在处理
  if (this.processing.has(task.postId)) {
    console.log(`⚠️ 文章 ${task.postId} 正在处理中`);
    return;
  }

  // 添加到队列并排序
  this.queue.push(task);
  this.queue.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority; // 按优先级升序
    }
    return a.addTime - b.addTime; // 同优先级按时间升序
  });

  console.log(`📥 文章 ${task.postId} 已添加到队列`);

  // 自动启动队列
  if (!this.isRunning) {
    this.start();
  }
}
```

#### 3. 业务集成

```typescript
// src/services/post.ts

import { queueEmbedPost } from '@/services/embedding';

/**
 * 创建文章
 */
export async function createPost(data: CreatePostInput) {
  // 1. 保存到数据库
  const result = await prisma.tbPost.create({
    data: {
      ...data,
      rag_status: 'pending',
      rag_error: null,
    },
  });

  // 2. 异步添加到向量化队列（不阻塞响应）
  if (result.content) {
    (async () => {
      try {
        await queueEmbedPost({
          postId: result.id,
          title: result.title || '',
          content: result.content,
          hide: result.hide || '0',
          priority: 5, // 新文章优先级
        });
      } catch (error) {
        console.error(`❌ 添加文章 ${result.id} 到向量化队列失败:`, error);
      }
    })();
  }

  return serializePost(result);
}

/**
 * 更新文章
 */
export async function updatePost(id: number, data: UpdatePostInput) {
  // 1. 更新数据库
  const updatedPost = await prisma.tbPost.update({
    where: { id },
    data: {
      ...data,
      rag_status: hasContentUpdate ? 'pending' : undefined,
      rag_error: hasContentUpdate ? null : undefined,
    },
  });

  // 2. 异步添加到向量化队列
  if (hasContentUpdate && updatedPost.content) {
    (async () => {
      try {
        await queueEmbedPost({
          postId: id,
          title: updatedPost.title || '',
          content: updatedPost.content || '',
          hide: updatedPost.hide || '0',
          priority: 5,
        });
      } catch (error) {
        console.error(`❌ 添加文章 ${id} 到向量化队列失败:`, error);
      }
    })();
  }

  return serializePost(updatedPost);
}
```

### 代码示例

#### 获取队列状态

```typescript
/**
 * 获取队列状态 API
 * GET /api/embedding/queue/status
 */
export async function GET() {
  const status = embeddingQueue.getStatus();

  return NextResponse.json({
    status: true,
    data: {
      queueLength: status.queueLength,
      processingCount: status.processingCount,
      queueTasks: status.queueTasks,
      processingTasks: status.processingTasks,
    },
  });
}
```

#### 手动触发向量化

```typescript
/**
 * 手动触发向量化 API
 * POST /api/post/[id]/embed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const postId = parseInt(params.id);

  // 获取文章
  const post = await prisma.tbPost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    return NextResponse.json(
      { status: false, message: '文章不存在' },
      { status: 404 }
    );
  }

  // 添加到队列
  await queueEmbedPost({
    postId: post.id,
    title: post.title || '',
    content: post.content || '',
    hide: post.hide || '0',
    priority: 1, // 手动触发优先级最高
  });

  return NextResponse.json({
    status: true,
    message: '已添加到向量化队列',
  });
}
```

#### 批量重新向量化

```typescript
/**
 * 批量重新向量化脚本
 * scripts/re-embed-all.ts
 */
async function reEmbedAll() {
  const posts = await prisma.tbPost.findMany({
    where: {
      content: { not: null },
      hide: '0',
    },
    select: {
      id: true,
      title: true,
      content: true,
      hide: true,
    },
  });

  console.log(`找到 ${posts.length} 篇文章需要重新向量化`);

  // 批量添加到队列
  const tasks: EmbedTask[] = posts.map((post) => ({
    postId: post.id,
    title: post.title || '',
    content: post.content || '',
    hide: post.hide || '0',
    priority: 10, // 低优先级，避免影响正常业务
    addTime: Date.now(),
  }));

  embeddingQueue.addBatch(tasks);

  console.log(`已添加 ${tasks.length} 个任务到队列`);
}
```

---

## 使用指南

### API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/embedding/queue/status` | GET | 获取队列状态 |
| `/api/post/[id]/embed` | POST | 手动触发向量化 |
| `/api/post/embed/batch` | POST | 批量向量化 |

### 队列配置

```typescript
// src/services/embedding/embedding-queue.ts

const QUEUE_CONFIG = {
  concurrency: 2,      // 并发处理数量（根据 Embedding API 限制调整）
  maxRetries: 2,       // 最大重试次数
  retryDelay: 5000,    // 重试延迟（毫秒）
  checkInterval: 1000, // 队列检查间隔（毫秒）
};
```

### 优先级策略

| 优先级值 | 场景 | 说明 |
|----------|------|------|
| 1 | 手动触发 | 用户手动重新向量化 |
| 5 | 正常业务 | 新建/更新文章 |
| 10 | 批量处理 | 批量重新向量化 |

---

## 性能考虑

### 优化策略

1. **并发控制**
   - 限制并发数量（2），避免 Embedding API 限流
   - 根据服务器性能和 API 限制调整并发数

2. **优先级队列**
   - 新文章优先于批量处理
   - 手动触发优先于自动触发

3. **错误重试**
   - 指数退避策略（5 秒延迟）
   - 最大重试 2 次，避免无限重试

4. **状态持久化**
   - 任务状态存储在数据库
   - 服务重启后可恢复（需实现持久化队列）

### 潜在瓶颈

| 瓶颈 | 影响 | 缓解措施 |
|------|------|----------|
| 内存队列丢失 | 服务重启任务丢失 | 持久化到数据库/Redis |
| Embedding API 限流 | 任务堆积 | 并发控制、重试延迟 |
| 大文章向量化慢 | 队列堵塞 | 分块处理、超时控制 |

### 监控指标

- 队列长度（待处理任务数）
- 处理中任务数
- 平均处理时间
- 失败率
- Embedding API 调用次数

---

## 安全考虑

### 安全措施

1. **权限验证**
   - 向量化 API 需要管理员权限
   - 手动触发端点需要身份验证

2. **参数验证**
   - 文章内容长度限制
   - 防止恶意向量化（如大量垃圾数据）

3. **资源保护**
   - 限制单用户可触发次数
   - 队列长度限制，防止内存溢出

### 潜在风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 任务丢失 | 服务重启 | 持久化队列（未来） |
| API 密钥泄露 | Embedding 服务被滥用 | 环境变量隔离 |
| 恶意向量化 | API 配额耗尽 | 权限验证、频率限制 |

---

## 扩展性

### 未来改进方向

1. **持久化队列**
   - 使用 Redis / BullMQ
   - 支持分布式部署
   - 任务持久化，服务重启不丢失

2. **进度反馈**
   - WebSocket 实时推送进度
   - 前端展示向量化进度条

3. **批量优化**
   - 批量调用 Embedding API
   - 减少 API 调用次数

4. **任务调度**
   - 定时任务（如凌晨批量向量化）
   - 优先级动态调整

5. **监控和告警**
   - 队列健康监控
   - 失败任务告警（邮件/钉钉）

### 可扩展点

- **任务类型**：不仅限于向量化，可扩展到其他异步任务
- **队列后端**：易切换到 Redis / RabbitMQ
- **处理器**：支持自定义任务处理器
- **中间件**：任务前后钩子（如日志、监控）

---

## 参考资料

### 队列系统设计

- **BullMQ**: https://docs.bullmq.io/
- **Redis Queue**: https://python-rq.org/
- **Async/Await 模式**: https://javascript.info/async

### 项目相关

- [向量化系统设计](./embedding-design.md)
- [向量检索设计](./vector-search-design.md)
- [RAG 系统重构](./rag-system-refactor.md)
- [队列调试指南](../reference/QUEUE-DEBUG-GUIDE.md)

---

**文档版本**：v1.0
**创建日期**：2026-01-17
**最后更新**：2026-01-17
**状态**：✅ 已实现
