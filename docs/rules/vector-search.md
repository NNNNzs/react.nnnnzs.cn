
# 向量检索与向量化系统开发规范

> **本文档定位**: 开发者操作手册 - 说明如何正确使用向量检索相关功能
>
> 本规范定义了向量检索系统的核心组件、开发规范和注意事项。
>
> **设计原理和架构**详见: [向量化系统总览](../designs/vector/overview.md)

## 📚 相关设计文档

在修改向量检索相关代码前，建议先阅读设计文档以了解整体架构：

- [向量化总览](../designs/vector/overview.md) - 系统整体架构
- [文本切片](../designs/vector/chunking.md) - Markdown 分块策略
- [向量存储](../designs/vector/storage.md) - Qdrant 集成
- [向量化队列](../designs/vector/queue.md) - 异步队列系统
- [语义搜索](../designs/search/semantic-search.md) - 向量检索实现

## 核心组件

### 文本切片
**位置**: `src/services/embedding/text-splitter.ts`

**关键规范**:
- 必须保留代码块标记 `[语言块]`
- 保留行内代码内容（移除反引号）
- 优先按 Markdown 标题结构分块
- 最大 chunk 大小: 500 字符
- 重叠区域: 100 字符

### 向量化服务
**位置**: `src/services/embedding/simple-embedder.ts`

**使用模型**:
- BAAI/bge-large-zh-v1.5
- 维度: 1024

**配置读取**:
- Embedding API 配置：从数据库 `tb_config` 表读取（`embedding.api_key`, `embedding.model`, `embedding.base_url`）
- 配置工具：`src/lib/ai-config.ts`（场景: `embedding`）

**向量化流程**:
1. 删除旧向量
2. 文本切片
3. 批量生成向量
4. 插入 Qdrant

### 向量存储
**位置**: `src/services/embedding/vector-store.ts`

**集合配置**（`src/lib/qdrant.ts`）:
```typescript
COLLECTION_NAME: 'post_vectors'
DIMENSION: 1024
// 距离: Cosine
```

**配置读取**:
- Qdrant 连接配置：从数据库 `tb_config` 表读取（`qdrant.url`, `qdrant.api_key`, `qdrant.timeout`）
- 回退机制：数据库配置不存在时回退到环境变量（`QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_TIMEOUT`）
- 客户端缓存：5 分钟 TTL
- 配置工具：`src/lib/vector-db-config.ts`

**Payload 结构**:
- `post_id`: 文章 ID
- `chunk_index`: 块索引
- `chunk_text`: 块内容
- `title`: 文章标题
- `hide`: 是否隐藏
- `created_at`: 创建时间戳

### 队列系统
**位置**: `src/services/embedding/embedding-queue.ts`

**队列配置**:
- 并发数: 2
- 最大重试: 2 次
- 重试延迟: 5000ms

**优先级**:
- 1: 手动触发
- 5: 正常业务
- 10: 批量处理

### 语义搜索
**位置**: `src/services/embedding/search.ts`

**默认参数**:
- `limit`: 10
- `scoreThreshold`: 0.7

**返回结果**:
- `postId`: 文章 ID
- `score`: 相似度分数 (0-1)
- `content`: 匹配的文本片段

## 开发规范

### 修改向量化逻辑
1. 先阅读 `docs/designs/vector/overview.md`
2. 确保理解全量更新机制
3. 修改后测试向量化功能
4. 验证检索质量

### 添加新的嵌入模型
1. 在数据库 `tb_config` 表中更新 `embedding.model`、`embedding.base_url` 等配置
2. 修改 `src/services/embedding/embedding.ts`（如需特殊处理）
3. 更新 Qdrant collection 的 vector_size（`src/lib/qdrant.ts`）
4. 在设计文档中记录新模型
5. 进行性能对比测试

### 性能优化
- 使用批量处理（每批 100 个向量插入）
- 异步队列处理（不阻塞 API 响应）
- Qdrant 客户端单例 + 配置缓存（5 分钟 TTL）
- 监控 API 调用次数和成本

## 注意事项

⚠️ **重要**:
- 文章更新时必须添加到向量化队列
- 使用队列系统异步执行（不要同步等待）
- 处理 API 限流错误
- 记录向量化状态到 `rag_status` 和 `rag_error`

❌ **不要做的事**:
- 发送向量数据到客户端
- 在客户端直接调用 Embedding API
- 同步等待向量化完成（会阻塞 API）
- 删除文章时不同步删除向量

✅ **应该做的事**:
- 使用队列系统异步处理向量化
- 实现重试机制处理 API 错误
- 全量更新向量（删除旧的，插入新的）
- 定期检查 `rag_status` 和 `rag_error`
