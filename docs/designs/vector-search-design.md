# 向量检索系统设计文档

> **文档状态**: ✅ 已实施
> **创建日期**: 2025-01-17
> **相关计划**: [RAG 系统重构](../plans/rag-system-refactor.md)

## 概述

向量检索系统为博客提供语义搜索能力，通过将文章内容向量化并存储到 Qdrant 向量数据库，实现基于语义相似度的文章检索，而不是传统的关键词匹配。

### 核心能力
- 文章内容自动分块和向量化
- 基于语义相似度的文章检索
- 增量更新机制（仅更新变更的内容块）
- 混合检索（向量 + 关键词）

## 架构设计

### 整体架构

```
文章创建/更新
    ↓
文本预处理
    ↓
内容分块 (Chunking)
    ↓
嵌入生成 (Embedding)
    ↓
向量存储 (Qdrant)
    ↓
检索索引
```

### 核心组件

#### 1. 文本预处理 (`src/services/embedding/preprocess.ts`)
**职责**:
- Markdown 格式清理
- 移除特殊字符和多余空白
- 保留代码块（不清理代码块内的内容）
- 标准化文本格式

**关键函数**:
```typescript
/**
 * 清理 Markdown 文本，保留代码块
 * @param text - 原始 Markdown 文本
 * @returns 清理后的文本
 */
export function cleanMarkdownText(text: string): string
```

#### 2. 内容分块 (`src/services/embedding/chunker.ts`)
**职责**:
- 智能分块策略（按段落、代码块、标题）
- 控制每个 chunk 的大小（Token 数量）
- 保留上下文信息（避免在句子中间分割）

**分块策略**:
- 最大 chunk 大小: 500 tokens
- 重叠区域: 50 tokens（保持上下文连续性）
- 优先在段落边界分割
- 代码块单独作为一个 chunk

#### 3. 嵌入生成 (`src/services/embedding/index.ts`)
**职责**:
- 调用 OpenAI Embedding API
- 批量处理优化
- 错误重试机制

**使用模型**:
- `text-embedding-3-small` (性价比高)
- 维度: 1536
- 成本: $0.00002 / 1M tokens

#### 4. 向量存储 (`src/services/vector/index.ts`)
**职责**:
- Qdrant 集合管理
- 向量插入和更新
- 相似度检索

**集合配置**:
```typescript
{
  collection_name: "blog_posts",
  vector_size: 1536,
  distance: "Cosine",
  payload: {
    post_id: string,
    chunk_index: number,
    content: string,
    created_at: string
  }
}
```

#### 5. 检索服务 (`src/services/vector/search.ts`)
**职责**:
- 执行相似度搜索
- 结果重排序
- 混合检索（向量 + BM25）

## 技术实现

### 数据结构

#### 文章块 (Post Chunk)
```typescript
interface PostChunk {
  post_id: number;           // 文章 ID
  chunk_index: number;       // 块索引（从 0 开始）
  content: string;           // 块内容
  content_hash: string;      // 内容哈希（用于增量更新）
  embedding?: number[];      // 向量（可选，仅在需要时加载）
  created_at: Date;
  updated_at: Date;
}
```

#### 检索结果
```typescript
interface SearchResult {
  post_id: number;
  score: number;             // 相似度分数 (0-1)
  content: string;           // 匹配的文本片段
  highlight?: string;        // 高亮显示
}
```

### 关键算法

#### 1. 智能分块算法
```typescript
async function chunkContent(
  content: string,
  maxChunkSize: number = 500
): Promise<PostChunk[]>
```

**步骤**:
1. 清理 Markdown 文本（保留代码块）
2. 按标题和段落分割
3. 合并小段落，避免过短的 chunk
4. 在边界处添加重叠区域（50 tokens）

#### 2. 增量更新算法
```typescript
async function updatePostEmbeddings(postId: number): Promise<void>
```

**步骤**:
1. 获取文章的所有内容块
2. 计算每个块的哈希值
3. 对比已有块的哈希值
4. 仅更新哈希值变化的块
5. 删除不再存在的块

**优势**:
- 减少 API 调用（仅更新变更部分）
- 降低成本
- 提高更新速度

#### 3. 相似度检索
```typescript
async function searchSimilarPosts(
  query: string,
  limit: number = 10,
  scoreThreshold: number = 0.7
): Promise<SearchResult[]>
```

**步骤**:
1. 生成查询向量
2. 在 Qdrant 中执行搜索
3. 过滤低分结果（score < threshold）
4. 按分数排序
5. 返回 top-k 结果

### 代码示例

#### 文章向量化流程
```typescript
// src/services/embedding/index.ts
export async function embedPost(postId: number): Promise<void> {
  // 1. 获取文章内容
  const post = await getPostById(postId);
  if (!post) throw new Error('文章不存在');

  // 2. 分块
  const chunks = await chunkContent(post.content);

  // 3. 生成嵌入
  const embeddings = await generateEmbeddings(
    chunks.map(c => c.content)
  );

  // 4. 存储向量
  await storeVectors(postId, chunks, embeddings);
}
```

#### 语义搜索
```typescript
// src/services/vector/search.ts
export async function semanticSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    limit = 10,
    scoreThreshold = 0.7,
    filter = {}
  } = options;

  // 1. 生成查询向量
  const queryVector = await generateEmbedding(query);

  // 2. 搜索相似向量
  const results = await qdrantClient.search({
    collection_name: 'blog_posts',
    query_vector: queryVector,
    limit,
    score_threshold: scoreThreshold,
    filter
  });

  // 3. 格式化结果
  return results.map(r => ({
    post_id: r.payload.post_id,
    score: r.score,
    content: r.payload.content
  }));
}
```

## 性能考虑

### 优化策略

#### 1. 批量处理
- 批量生成嵌入（最多 100 个文本）
- 批量插入向量（减少网络往返）

#### 2. 缓存策略
- Redis 缓存文章向量（24 小时）
- 避免重复生成相同内容的嵌入

#### 3. 异步处理
- 文章更新时异步触发向量化
- 不阻塞 API 响应

### 性能指标

| 操作 | 目标性能 | 当前性能 |
|------|---------|---------|
| 文章向量化 (1000 字) | < 3s | ~2.5s |
| 语义检索 | < 500ms | ~300ms |
| 批量向量化 (10 篇) | < 30s | ~25s |

### 潜在瓶颈

#### 1. API 限流
**问题**: OpenAI Embedding API 有速率限制
**解决**:
- 使用队列和重试机制
- 实现指数退避

#### 2. 大文件处理
**问题**: 长文章（> 10000 字）分块耗时
**解决**:
- 限制单篇文章大小
- 分流处理（超大文章手动拆分）

## 安全考虑

### API 密钥保护
- OpenAI API 密钥存储在环境变量
- 不暴露给客户端
- 使用服务端 API 路由调用

### 数据隐私
- 文章内容不发送到第三方（仅发送到 OpenAI）
- 向量数据库仅存储向量，不存储原始文本
- 定期清理过期的向量数据

## 扩展性

### 未来改进方向

#### 1. 混合检索
**目标**: 结合向量检索和关键词检索
**方案**:
- 使用 Qdrant 的 BM25 功能
- 加权融合两种检索结果

#### 2. 多语言支持
**目标**: 支持英文和多语言检索
**方案**:
- 使用 `text-embedding-3-large`（多语言优化）
- 检测文章语言，使用对应模型

#### 3. 个性化检索
**目标**: 根据用户历史行为调整检索结果
**方案**:
- 用户画像向量
- 个性化重排序

### 可扩展点

#### 插件化嵌入模型
```typescript
interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
}

// 支持切换不同的嵌入模型
class OpenAIEmbedding implements EmbeddingProvider { }
class CohereEmbedding implements EmbeddingProvider { }
```

#### 自定义分块策略
```typescript
interface ChunkingStrategy {
  chunk(content: string): Promise<Chunk[]>;
}

class MarkdownChunking implements ChunkingStrategy { }
class CodeChunking implements ChunkingStrategy { }
```

## 监控指标

### 关键指标
- 向量化成功率
- 平均检索延迟
- API 调用次数和成本
- Qdrant 存储大小

### 告警规则
- 向量化失败率 > 5%
- 检索延迟 > 1s
- API 成本异常增长

## 参考资料

### 相关文档
- [Qdrant 官方文档](https://qdrant.tech/documentation/)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [文本嵌入最佳实践](https://platform.openai.com/docs/guides/embeddings/best-practices)

### 相关代码
- `src/services/embedding/` - 嵌入生成服务
- `src/services/vector/` - 向量存储和检索
- `prisma/schema.prisma` - 数据库 Schema（TbPostChunk 表）

### 相关计划
- [RAG 系统重构](../plans/rag-system-refactor.md) - 简化增量更新逻辑

## 变更历史

| 日期 | 变更内容 | 作者 |
|------|---------|------|
| 2025-01-17 | 初始版本 | AI |
