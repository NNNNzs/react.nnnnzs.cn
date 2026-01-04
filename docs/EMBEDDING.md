# 文章向量化功能文档

## 概述

文章向量化功能将博客文章内容按照语义进行切片，生成向量嵌入，并存储到 Qdrant 向量数据库中，用于后续的语义搜索和相似文章推荐。

## 功能特性

- ✅ **语义切片**：将 Markdown 格式的文章内容按照段落、句子进行智能切片
- ✅ **向量嵌入**：使用 BAAI/bge-large-zh-v1.5 模型生成 1024 维向量
- ✅ **向量存储**：将向量数据存储到 Qdrant 向量数据库
- ✅ **自动向量化**：在创建或更新文章时自动触发向量化
- ✅ **批量处理**：支持批量生成向量嵌入，提高效率
- ✅ **鉴权支持**：支持 Qdrant API Key 认证

## 环境变量配置

在 `.env` 文件中添加以下配置：

```env
# 嵌入模型配置
BLOG_EMBEDDING_API_KEY=sk-xxx
BLOG_EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
BLOG_EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5
BLOG_EMBEDDING_RERANK_MODEL=BAAI/bge-reranker-v2-m3

# Qdrant 配置
QDRANT_URL=http://localhost:6333  # Qdrant 服务地址
QDRANT_API_KEY=your-api-key  # Qdrant API Key（如果启用了鉴权）
```

## Qdrant 部署

Qdrant 可以通过以下方式部署：

### 方式一：Docker 部署

```bash
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

### 方式二：使用 Docker Compose

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
      - QDRANT__SERVICE__API_KEY=your-api-key  # 可选，启用 API Key 认证
```

### 方式三：Qdrant Cloud

如果使用 Qdrant Cloud，直接使用云服务提供的 URL 和 API Key 即可。

> **注意**：如果启用了 API Key 认证，必须在环境变量中配置 `QDRANT_API_KEY`。

## 工作流程

### 1. 应用启动时初始化

应用启动时会自动初始化 Qdrant 集合（通过 `src/instrumentation.ts`）：

- 检查集合是否存在
- 如果不存在，创建集合和索引
- 验证集合配置

### 2. 文章保存时向量化

当创建或更新文章时，系统会：

1. **文本切片**：将 Markdown 内容按语义切分为多个片段（每个片段约 500 字符，重叠 100 字符）
2. **生成向量**：批量调用嵌入模型 API，为每个片段生成 1024 维向量
3. **删除旧数据**：删除该文章的旧向量数据（如果存在）
4. **存储向量**：将新生成的向量数据插入到 Qdrant

### 3. 向量数据结构

每个向量数据包含以下字段：

- `id`：唯一标识符（格式：`{postId}_{chunkIndex}`）
- `vector`：向量嵌入（1024 维浮点数组）
- `payload`：元数据对象
  - `post_id`：文章ID（整数）
  - `chunk_index`：片段索引（整数）
  - `chunk_text`：片段文本内容（字符串）
  - `title`：文章标题（字符串）
  - `created_at`：创建时间戳（整数）

## API 接口

### 手动触发向量化

```bash
POST /api/post/embed
Content-Type: application/json
Authorization: Bearer <token>

{
  "postId": 1,
  "title": "文章标题",
  "content": "文章内容（Markdown 格式）"
}
```

响应：

```json
{
  "status": true,
  "message": "文章向量化成功",
  "data": {
    "insertedCount": 5,
    "chunkCount": 5
  }
}
```

## 使用示例

### 在代码中调用向量化服务

```typescript
import { embedPost } from '@/services/embedding';

// 向量化文章
const result = await embedPost({
  postId: 1,
  title: '文章标题',
  content: '# 文章内容\n\n这是文章正文...',
});

console.log(`成功插入 ${result.insertedCount} 个向量`);
```

### 向量搜索（未来功能）

```typescript
import { searchSimilarVectors } from '@/services/embedding/vector-store';
import { embedText } from '@/services/embedding/embedding';

// 1. 将查询文本转换为向量
const queryVector = await embedText('搜索关键词');

// 2. 在 Qdrant 中搜索相似向量
const results = await searchSimilarVectors(queryVector, 10);

// 3. 可选：添加过滤条件（例如只搜索特定文章）
const filteredResults = await searchSimilarVectors(queryVector, 10, {
  must: [
    {
      key: 'post_id',
      match: { value: 123 },
    },
  ],
});

// 4. 处理搜索结果
results.forEach((result) => {
  console.log(`文章 ${result.postId}，相似度: ${result.score}`);
  console.log(`片段内容: ${result.chunkText}`);
});
```

## 配置说明

### 文本切片配置

可以在 `src/services/embedding/text-splitter.ts` 中调整切片参数：

```typescript
splitMarkdownIntoChunks(content, {
  chunkSize: 500,      // 每个片段的最大字符数
  chunkOverlap: 100,   // 片段之间的重叠字符数
  minChunkSize: 100,   // 最小片段字符数
});
```

### Qdrant 集合配置

可以在 `src/lib/qdrant.ts` 中调整集合参数：

```typescript
await client.createCollection(COLLECTION_NAME, {
  vectors: {
    size: 1024,              // 向量维度
    distance: 'Cosine',      // 距离度量（余弦相似度）
  },
  optimizers_config: {
    default_segment_number: 2,  // 段数量
  },
  replication_factor: 1,     // 副本因子
});
```

## 注意事项

1. **向量化是异步的**：在创建/更新文章时，向量化在后台异步执行，不会阻塞 API 响应
2. **向量化失败不影响文章操作**：如果向量化失败，只会记录错误日志，不会影响文章的创建或更新
3. **Qdrant 连接失败**：如果 Qdrant 服务不可用，应用仍可正常启动，但向量化功能将不可用
4. **向量维度**：当前使用 BAAI/bge-large-zh-v1.5 模型，向量维度为 1024，如需更换模型，需要修改 `QDRANT_COLLECTION_CONFIG.DIMENSION`

## 故障排查

### Qdrant 连接失败

检查：
1. Qdrant 服务是否正常运行
2. `QDRANT_URL` 环境变量是否正确
3. 如果启用了鉴权，`QDRANT_API_KEY` 是否正确
4. 网络连接是否正常

### 向量化失败

检查：
1. 嵌入模型 API 配置是否正确（`BLOG_EMBEDDING_API_KEY`、`BLOG_EMBEDDING_BASE_URL`）
2. API 配额是否充足
3. 文章内容是否为空

### 集合初始化失败

检查：
1. Qdrant 服务是否正常运行
2. 如果启用了鉴权，API Key 是否有足够的权限创建集合
3. 查看应用启动日志中的错误信息
4. 检查 Qdrant 服务日志

## 未来扩展

- [ ] 实现语义搜索功能
- [ ] 实现相似文章推荐
- [ ] 支持批量向量化历史文章
- [ ] 添加向量化进度监控
- [ ] 支持多种嵌入模型切换
