# 向量化系统设计文档

## 概述

本项目的向量化系统将博客文章内容转换为高维向量，存储到 Qdrant 向量数据库中，用于语义搜索、相似文章推荐和 RAG（检索增强生成）等场景。

### 核心特性

- **智能文本切片**：按 Markdown 结构语义分块，保留代码块和行内代码
- **批量向量化**：使用 BAAI/bge-large-zh-v1.5 模型生成 1024 维向量
- **异步队列**：通过内存队列管理向量化任务，不阻塞主流程
- **全量更新策略**：每次重新生成向量，保证数据一致性
- **错误重试机制**：自动重试失败任务，提高可靠性

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                   业务层（post.ts）                       │
│  - createPost() / updatePost()                          │
│  - queueEmbedPost() 添加任务到队列                        │
│  - 更新 rag_status 和 rag_error                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                 队列系统（embedding-queue.ts）             │
│  - 内存优先级队列                                        │
│  - 并发控制（Concurrency = 2）                           │
│  - 错误重试（Max Retries = 2）                           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              向量化服务（simple-embedder.ts）              │
│  1. 删除旧向量（deleteVectorsByPostId）                  │
│  2. 文本切片（splitMarkdownIntoChunks）                  │
│  3. 批量生成向量（embedTexts）                           │
│  4. 插入新向量（insertVectors）                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│               文本切片（text-splitter.ts）                 │
│  - 按标题分块（splitMarkdownByHeadings）                 │
│  - 普通文本切片（splitTextIntoChunks）                   │
│  - 内容清理（normalizeContent）                          │
│    ├─ 保留代码块标记：[语言块]                           │
│    ├─ 保留行内代码内容                                   │
│    └─ 移除 Markdown 语法                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Embedding API（SiliconFlow）                 │
│  - 模型：BAAI/bge-large-zh-v1.5                         │
│  - 维度：1024                                            │
│  - 批量调用：减少请求次数                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  Qdrant 向量数据库                        │
│  - Collection: blog_posts                               │
│  - Vector Size: 1024                                     │
│  - Distance: Cosine                                     │
│  - Payload: postId, chunkIndex, chunkText, title, hide   │
└─────────────────────────────────────────────────────────┘
```

### 核心组件

| 组件 | 路径 | 职责 |
|------|------|------|
| **队列系统** | `src/services/embedding/embedding-queue.ts` | 任务队列、并发控制、错误重试 |
| **向量化服务** | `src/services/embedding/simple-embedder.ts` | 全量向量化流程编排 |
| **文本切片** | `src/services/embedding/text-splitter.ts` | Markdown 分块、内容清理 |
| **Embedding API** | `src/services/embedding/embedding.ts` | 向量生成、批量处理 |
| **向量存储** | `src/services/embedding/vector-store.ts` | Qdrant CRUD 操作 |
| **初始化脚本** | `src/instrumentation.ts` | 应用启动时创建 Qdrant 集合 |

---

## 技术实现

### 环境变量配置

```env
# Embedding API 配置
BLOG_EMBEDDING_API_KEY=sk-xxx
BLOG_EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
BLOG_EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5

# Qdrant 配置
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-api-key  # 可选，如果启用了鉴权
```

### 数据结构

#### Qdrant Collection 配置

```typescript
// src/lib/qdrant.ts

export const QDRANT_COLLECTION_CONFIG = {
  NAME: 'blog_posts',
  DIMENSION: 1024,        // BAAI/bge-large-zh-v1.5 向量维度
  DISTANCE: 'Cosine',     // 余弦相似度
};

export interface VectorDataItem {
  postId: number;
  chunkIndex: number;
  chunkText: string;
  title: string;
  hide?: string;
  embedding: number[];
  createdAt: number;
}
```

#### 文章状态字段

```prisma
// prisma/schema.prisma

model TbPost {
  // ... 其他字段

  rag_status     String?  @default("pending")  // 向量化状态
  rag_error      String?  @db.Text             // 错误信息
}
```

### 关键流程

#### 1. 向量化流程

```typescript
// src/services/embedding/simple-embedder.ts

export async function simpleEmbedPost(
  params: SimpleEmbedParams
): Promise<SimpleEmbedResult> {
  const { postId, title, content, hide = '0' } = params;

  // 1. 删除旧向量
  await deleteVectorsByPostId(postId);

  // 2. 文本切片
  const chunks = splitMarkdownIntoChunks(content, {
    chunkSize: 500,      // 每个片段的最大字符数
    chunkOverlap: 100,   // 片段之间的重叠字符数
    minChunkSize: 100,   // 最小片段字符数
  });

  // 3. 批量生成向量
  const texts = chunks.map((c) => c.text);
  const embeddings = await embedTexts(texts);

  // 4. 准备向量数据
  const vectorItems: VectorDataItem[] = chunks.map((chunk, index) => ({
    postId,
    chunkIndex: index,
    chunkText: chunk.text,  // 保留完整内容（不过度清理）
    title,
    hide,
    embedding: embeddings[index],
    createdAt: Date.now(),
  }));

  // 5. 插入向量
  const insertedCount = await insertVectors(vectorItems);

  return { insertedCount, chunkCount: chunks.length };
}
```

#### 2. 文本切片策略

```typescript
// src/services/embedding/text-splitter.ts

/**
 * Markdown 文本切片（按标题结构分块）
 */
export function splitMarkdownByHeadings(
  content: string,
  config: ChunkConfig = {}
): Chunk[] {
  // 1. 提取标题结构（# ## ###）
  const sections = extractMarkdownSections(content);

  // 2. 遍历每个区块
  for (const section of sections) {
    // 3. 内容清理
    const plainText = normalizeContent(section.content);

    // 4. 如果区块内容过长，进一步分割
    if (plainText.length > config.chunkSize) {
      const subChunks = splitTextIntoChunks(plainText, config);
      chunks.push(...subChunks);
    } else {
      chunks.push({
        text: plainText,
        metadata: { heading: section.heading },
      });
    }
  }

  return chunks;
}

/**
 * 内容清理（保留关键信息）
 */
function normalizeContent(content: string): string {
  return content
    // 代码块：提取语言标记和第一行注释
    .replace(/```[\s\S]*?```/g, (match) => {
      const lines = match.split('\n');
      if (lines.length >= 2) {
        const lang = lines[0].replace(/```\w*/, '').trim() || '代码';
        return `[${lang}块] `;
      }
      return '';
    })
    // 行内代码：保留代码内容（移除反引号）
    .replace(/`([^`]+)`/g, '$1')
    // 移除链接，保留链接文本
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // 移除图片
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
    // 移除标题标记
    .replace(/^#{1,6}\s+/gm, '')
    // 移除粗体和斜体标记
    .replace(/\*\*([^\*]+)\*\*/g, '$1')
    .replace(/\*([^\*]+)\*/g, '$1')
    // 清理多余空白
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

#### 3. 批量向量生成

```typescript
// src/services/embedding/embedding.ts

/**
 * 批量生成向量
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const batchSize = 10;  // 每批最多 10 个文本
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await fetch(
      `${process.env.BLOG_EMBEDDING_BASE_URL}/embeddings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.BLOG_EMBEDDING_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.BLOG_EMBEDDING_MODEL,
          input: batch,
          encoding_format: 'float',
        }),
      }
    );

    const data = await response.json();
    const embeddings = data.data.map((item: any) => item.embedding);

    results.push(...embeddings);
  }

  return results;
}
```

#### 4. Qdrant 向量操作

```typescript
// src/services/embedding/vector-store.ts

/**
 * 批量插入向量
 */
export async function insertVectors(
  items: VectorDataItem[]
): Promise<number> {
  const points = items.map((item) => ({
    id: `${item.postId}_${item.chunkIndex}`,  // 唯一 ID
    vector: item.embedding,
    payload: {
      post_id: item.postId,
      chunk_index: item.chunkIndex,
      chunk_text: item.chunkText,
      title: item.title,
      hide: item.hide || '0',
      created_at: item.createdAt,
    },
  }));

  const response = await qdrantClient.upsert(COLLECTION_NAME, {
    points,
  });

  return response.status === 'completed' ? items.length : 0;
}

/**
 * 删除文章的所有向量
 */
export async function deleteVectorsByPostId(postId: number): Promise<void> {
  await qdrantClient.delete(COLLECTION_NAME, {
    filter: {
      must: [
        {
          key: 'post_id',
          match: { value: postId },
        },
      ],
    },
  });
}
```

### 代码示例

#### 手动触发向量化

```typescript
// src/app/api/post/[id]/embed/route.ts

import { simpleEmbedPost } from '@/services/embedding';

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

  // 同步执行向量化
  const result = await simpleEmbedPost({
    postId: post.id,
    title: post.title || '',
    content: post.content || '',
    hide: post.hide || '0',
  });

  return NextResponse.json({
    status: true,
    message: '向量化成功',
    data: result,
  });
}
```

#### 批量重新向量化

```typescript
// scripts/re-embed-all.ts

async function reEmbedAll() {
  const posts = await prisma.tbPost.findMany({
    where: {
      content: { not: null },
      hide: '0',
    },
  });

  for (const post of posts) {
    await simpleEmbedPost({
      postId: post.id,
      title: post.title || '',
      content: post.content || '',
      hide: post.hide || '0',
    });

    console.log(`✅ 文章 ${post.id} 向量化完成`);

    // 避免触发 API 限流
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

---

## 使用指南

### Qdrant 部署

#### 方式一：Docker

```bash
docker run -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  -e QDRANT__SERVICE__API_KEY=your-api-key \
  qdrant/qdrant:latest
```

#### 方式二：Docker Compose

```yaml
version: '3.8'
services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - ./qdrant_storage:/qdrant/storage
    environment:
      - QDRANT__SERVICE__API_KEY=your-api-key
```

### API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/post/[id]/embed` | POST | 手动触发向量化 |
| `/api/post/embed/batch` | POST | 批量向量化 |
| `/api/embedding/queue/status` | GET | 获取队列状态 |

### 配置参数

#### 文本切片配置

```typescript
// src/services/embedding/text-splitter.ts

const DEFAULT_CONFIG: ChunkConfig = {
  chunkSize: 500,      // 每个片段的最大字符数
  chunkOverlap: 100,   // 片段之间的重叠字符数
  minChunkSize: 100,   // 最小片段字符数
};
```

#### 队列配置

```typescript
// src/services/embedding/embedding-queue.ts

const QUEUE_CONFIG = {
  concurrency: 2,      // 并发处理数量
  maxRetries: 2,       // 最大重试次数
  retryDelay: 5000,    // 重试延迟（毫秒）
  checkInterval: 1000, // 队列检查间隔（毫秒）
};
```

---

## 性能考虑

### 优化策略

1. **批量处理**
   - Embedding API 批量调用（每批 10 个文本）
   - 减少 API 请求次数

2. **异步队列**
   - 不阻塞主流程（API 响应 < 100ms）
   - 并发控制（2 个并发任务）

3. **全量更新**
   - 每次重新生成向量，避免增量更新的复杂性
   - 删除旧数据，避免数据冗余

4. **文本切片优化**
   - 按标题结构分块，保持语义完整性
   - 重叠 100 字符，避免边界信息丢失

### 潜在瓶颈

| 瓶颈 | 影响 | 缓解措施 |
|------|------|----------|
| Embedding API 延迟 | 单个文章向量化 ~2-5 秒 | 批量处理、异步队列 |
| Qdrant 写入性能 | 批量插入 ~500ms | 批量操作、索引优化 |
| 大文章切片 | 切片数量多，向量化慢 | 限制切片数量、分批处理 |

### 监控指标

- 平均向量化时间（目标 < 5 秒）
- Embedding API 调用次数
- Qdrant 操作成功率
- 队列长度和处理速度
- 向量化失败率

---

## 安全考虑

### 安全措施

1. **API 密钥管理**
   - 使用环境变量存储密钥
   - 不在代码中硬编码密钥
   - 定期轮换密钥

2. **权限验证**
   - 向量化 API 需要管理员权限
   - 手动触发端点需要身份验证

3. **输入验证**
   - 文章内容长度限制
   - 防止恶意向量化（如大量垃圾数据）

### 潜在风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| API 密钥泄露 | Embedding 服务被滥用 | 环境变量隔离、定期轮换 |
| Qdrant 未授权访问 | 向量数据泄露 | API Key 认证、网络隔离 |
| 恶意向量化 | API 配额耗尽 | 权限验证、频率限制 |

---

## 扩展性

### 未来改进方向

1. **持久化队列**
   - 使用 Redis / BullMQ
   - 支持任务持久化
   - 支持分布式部署

2. **智能切片**
   - 代码块单独切片
   - 提取代码注释和变量名

3. **多模型支持**
   - 支持多种 Embedding 模型
   - 支持本地模型（如 Ollama）

4. **向量优化**
   - 量化向量（Float32 → Int8）
   - 减少 Qdrant 存储空间

5. **增量更新**
   - Hash 对比检测内容变化
   - 只更新变化的片段

### 可扩展点

- **切片策略**：可扩展到其他文档格式（PDF、Word）
- **向量模型**：易切换到其他 Embedding 模型
- **向量数据库**：支持 Qdrant、Milvus、Weaviate
- **队列系统**：易切换到 Redis / RabbitMQ

---

## 参考资料

### Embedding 模型

- **BAAI/bge-large-zh-v1.5**: https://huggingface.co/BAAI/bge-large-zh-v1.5
- **SiliconFlow**: https://docs.siliconflow.cn/

### 向量数据库

- **Qdrant 文档**: https://qdrant.tech/documentation/
- **Qdrant Cloud**: https://cloud.qdrant.io/

### 项目相关

- [向量检索设计](./vector-search-design.md)
- [RAG 系统重构](./rag-system-refactor.md)
- [队列系统设计](./queue-design.md)
- [聊天系统设计](./chat-system-design.md)

---

**文档版本**：v1.0
**创建日期**：2026-01-17
**最后更新**：2026-01-17
**状态**：✅ 已实现
