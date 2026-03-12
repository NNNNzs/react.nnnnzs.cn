# 向量存储 (Qdrant)

> **状态**: ✅ 已实施
> **创建日期**: 2026-01-17
> **相关文档**: [向量化总览](./overview.md) | [文本切片](./chunking.md)

## 概述

向量存储模块负责管理与 Qdrant 向量数据库的交互，包括集合创建、向量插入/更新/删除、相似度检索等操作。

### 核心特性

- **集合管理**：自动创建和配置 Qdrant 集合
- **批量操作**：支持批量插入和删除向量
- **索引优化**：使用 Cosine 相似度，高效检索
- **错误处理**：完善的错误重试和日志记录

## 文件位置

**实现文件**：`src/services/embedding/vector-store.ts`
**初始化脚本**：`src/instrumentation.ts`

## Qdrant 配置

### Collection 配置

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

### Payload 结构

```typescript
{
  post_id: number;      // 文章 ID
  chunk_index: number;   // 块索引（从 0 开始）
  chunk_text: string;    // 块内容
  title: string;         // 文章标题
  hide: string;          // 是否隐藏（'0' 或 '1'）
  created_at: number;    // 创建时间戳
}
```

## 核心操作

### 1. 创建集合

```typescript
// src/instrumentation.ts

export async function initQdrantCollection() {
  const collections = await qdrantClient.getCollections();

  const exists = collections.collections.some(
    (c) => c.name === QDRANT_COLLECTION_CONFIG.NAME
  );

  if (!exists) {
    await qdrantClient.createCollection(QDRANT_COLLECTION_CONFIG.NAME, {
      vectors: {
        size: QDRANT_COLLECTION_CONFIG.DIMENSION,
        distance: QDRANT_COLLECTION_CONFIG.DISTANCE,
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 1,
    });

    console.log(`✅ Qdrant 集合 ${QDRANT_COLLECTION_CONFIG.NAME} 创建成功`);
  }
}
```

### 2. 批量插入向量

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
```

### 3. 删除文章向量

```typescript
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

### 4. 相似度检索

```typescript
/**
 * 相似度检索
 */
export async function searchSimilar(
  queryVector: number[],
  limit: number = 10,
  scoreThreshold: number = 0.7,
  filters?: Record<string, unknown>
): Promise<SearchResult[]> {
  const filter = filters ? buildFilter(filters) : undefined;

  const response = await qdrantClient.search(COLLECTION_NAME, {
    vector: queryVector,
    limit,
    score_threshold: scoreThreshold,
    filter,
  });

  return response.map((point) => ({
    postId: point.payload.post_id as number,
    chunkIndex: point.payload.chunk_index as number,
    content: point.payload.chunk_text as string,
    title: point.payload.title as string,
    score: point.score,
  }));
}
```

## 使用示例

### 基础用法

```typescript
import { insertVectors, deleteVectorsByPostId } from '@/services/embedding/vector-store';
import { embedTexts } from '@/services/embedding/embedding';

async function updateArticleVectors(postId: number, content: string) {
  // 1. 删除旧向量
  await deleteVectorsByPostId(postId);

  // 2. 生成新向量
  const chunks = splitMarkdownIntoChunks(content);
  const embeddings = await embedTexts(chunks.map((c) => c.text));

  // 3. 插入新向量
  const items: VectorDataItem[] = chunks.map((chunk, index) => ({
    postId,
    chunkIndex: index,
    chunkText: chunk.text,
    title: '文章标题',
    embedding: embeddings[index],
    createdAt: Date.now(),
  }));

  const count = await insertVectors(items);
  console.log(`插入了 ${count} 个向量`);
}
```

### 相似度搜索

```typescript
import { searchSimilar } from '@/services/embedding/vector-store';
import { embedText } from '@/services/embedding/embedding';

async function findSimilarArticles(query: string) {
  // 1. 生成查询向量
  const queryVector = await embedText(query);

  // 2. 检索相似向量
  const results = await searchSimilar(queryVector, 10, 0.7, {
    hide: '0',  // 只搜索公开文章
  });

  // 3. 按文章 ID 去重
  const uniquePosts = deduplicateByPostId(results);

  return uniquePosts;
}
```

## 环境变量

```env
# Qdrant 配置
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-api-key  # 可选，如果启用了鉴权
```

## 部署方式

### Docker

```bash
docker run -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  -e QDRANT__SERVICE__API_KEY=your-api-key \
  qdrant/qdrant:latest
```

### Docker Compose

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

### Qdrant Cloud

```bash
# 安装 Qdrant CLI
curl -L https://github.com/qdrant/qdrant-cloud/releases/latest/download/qdrant-cloud-linux-x64 -o qdrant-cloud
chmod +x qdrant-cloud

# 连接到云服务
./qdrant-cloud connect
```

## 性能优化

### 1. 批量操作

- 使用 `upsert` 批量插入，减少网络往返
- 批量大小建议：100-1000 个向量

### 2. 索引优化

```typescript
// 创建集合时配置索引
await qdrantClient.createCollection(COLLECTION_NAME, {
  vectors: {
    size: 1024,
    distance: 'Cosine',
  },
  optimizers_config: {
    default_segment_number: 2,  // 默认段数
    indexing_threshold: 20000,  // 索引阈值
  },
  hnsw_config: {
    m: 16,      // 连接数
    ef_construct: 100,  // 构建时的搜索深度
  },
});
```

### 3. 过滤优化

```typescript
// 使用 Payload Index 加速过滤
await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
  field_name: 'post_id',
  field_schema: 'integer',
});

await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
  field_name: 'hide',
  field_schema: 'keyword',
});
```

## 监控指标

- **存储大小**：集合占用的存储空间
- **向量数量**：当前存储的向量总数
- **查询延迟**：平均查询响应时间
- **写入吞吐**：每秒写入的向量数量

## 安全考虑

### API Key 认证

```bash
# 启动时设置 API Key
docker run -p 6333:6333 \
  -e QDRANT__SERVICE__API_KEY=your-secret-key \
  qdrant/qdrant:latest
```

```typescript
// 客户端连接时提供 API Key
import { QdrantClient } from '@qdrant/js-client-rest';

const client = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});
```

### 网络隔离

- 生产环境建议使用 VPC 网络隔离
- 限制 Qdrant 端口的外部访问

## 故障排查

### 连接失败

```bash
# 检查 Qdrant 服务状态
curl http://localhost:6333/

# 检查集合列表
curl http://localhost:6333/collections
```

### 性能问题

```typescript
// 查看集合信息
const collectionInfo = await qdrantClient.getCollectionInfo(COLLECTION_NAME);
console.log(collectionInfo);

// 输出示例：
// {
//   status: 'green',
//   vectors_count: 10000,
//   segments_count: 2,
//   points_count: 10000,
//   config: { ... }
// }
```

## 参考资料

- [Qdrant 官方文档](https://qdrant.tech/documentation/)
- [Qdrant JavaScript Client](https://github.com/qdrant/qdrant-js)
- [Qdrant Cloud](https://cloud.qdrant.io/)
- [HNSW 算法说明](https://qdrant.tech/documentation/guides/quantization/)

---

**文档版本**：v1.0
**创建日期**：2026-01-17
**最后更新**：2026-03-12
**状态**：✅ 已实现
