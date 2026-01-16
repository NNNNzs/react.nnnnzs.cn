# RAG 系统重构计划：简化向量更新机制

## 问题分析

### 当前系统存在的问题

1. **数据不完整**（严重）
   - 位置：`src/services/embedding/text-splitter.ts:213-239`
   - 问题：`normalizeContent()` 过度清理，移除代码块、行内代码等关键内容
   - 影响：向量数据库中存储的内容不完整，搜索质量差

2. **更新不可靠**（严重）
   - 位置：`src/services/post.ts:413-431`
   - 问题：异步执行向量化，失败时只记录日志，用户无法感知
   - 影响：文章更新成功但向量未更新，导致搜索结果与实际内容不一致

3. **架构过度复杂**（中等）
   - 增量更新逻辑依赖 `TbPostChunk` 表存储元数据
   - 通过 Hash 对比实现增量更新
   - 需要版本化管理 (`TbPostVersion`)
   - 约 1500+ 行代码维护成本高

### 用户需求
- 现在有免费的 embedding API，不需要考虑成本
- 希望简化设计，提高可靠性
- 可以接受每次全量更新向量

---

## 简化方案设计

### 核心思想

**移除增量更新，改为全量更新 + 同步执行，保证数据一致性和可靠性。**

### 关键决策

| 决策项 | 当前方案 | 新方案 | 理由 |
|--------|----------|--------|------|
| 数据模型 | TbPostChunk + TbPostVersion | 仅 Qdrant | Qdrant 已存储完整数据，无需冗余 |
| 更新策略 | 增量更新（Hash 对比） | 全量更新 | API 免费，简化逻辑 |
| 执行方式 | 异步（静默失败） | 同步（失败明确反馈） | 用户需要知道向量化状态 |
| 文本清理 | 过度清理（移除代码） | 保留完整内容 | 提高搜索质量 |

---

## 实施计划

### 阶段 1：修复文本清理逻辑（高优先级）

**目标**：保留完整内容，提高向量质量

**修改文件**：`src/services/embedding/text-splitter.ts`

**变更内容**：

1. **修改 `splitMarkdownByHeadings` 函数**（第 213-239 行）
   ```typescript
   // 当前（问题代码）
   const plainText = content
     .replace(/```[\s\S]*?```/g, '')        // ❌ 移除代码块
     .replace(/`[^`]+`/g, '')               // ❌ 移除行内代码
     // ...

   // 修改为
   const plainText = content
     .replace(/```[\s\S]*?```/g, (match) => {
       // ✅ 提取代码块的第一行描述
       const lines = match.split('\n');
       if (lines.length >= 2) {
         const lang = lines[0].replace(/```\w*/, '').trim() || '代码';
         return `[${lang}块] `;
       }
       return '';
     })
     .replace(/`([^`]+)`/g, '$1')           // ✅ 保留行内代码内容
     .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')  // ✅ 保留链接文本
     .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')   // 移除图片（图片 alt 无意义）
     // ... 其他清理保持不变
   ```

2. **修改 `splitMarkdownIntoChunks` 函数**（第 300-326 行）
   - 应用相同的修复逻辑

**验证方法**：
```bash
# 测试文本切片
cd D:\project\react.nnnnzs.cn
pnpm exec ts-node -e "
import { splitMarkdownIntoChunks } from './src/services/embedding/text-splitter';
const markdown = '# 测试\n\`\`\`typescript\nconst a = 1;\n\`\`\`\n\n这是 \`代码\` 示例';
const chunks = splitMarkdownIntoChunks(markdown);
console.log(chunks[0].text);
"
```

---

### 阶段 2：创建简化的向量化服务（核心）

**目标**：移除增量更新逻辑，改为全量更新

**新建文件**：`src/services/embedding/simple-embedder.ts`

**实现逻辑**：

```typescript
/**
 * 简化的全量向量化服务
 * 移除增量更新逻辑，每次全量重新生成向量
 */

import { deleteVectorsByPostId, insertVectors, type VectorDataItem } from './vector-store';
import { splitMarkdownIntoChunks } from './text-splitter';
import { embedTexts } from './embedding';

export interface SimpleEmbedParams {
  postId: number;
  title: string;
  content: string;
  hide?: string;
}

export interface SimpleEmbedResult {
  insertedCount: number;
  chunkCount: number;
}

/**
 * 全量向量化文章（同步执行）
 *
 * 流程：
 * 1. 删除旧向量
 * 2. 文本切片
 * 3. 批量生成向量
 * 4. 插入新向量
 */
export async function simpleEmbedPost(
  params: SimpleEmbedParams
): Promise<SimpleEmbedResult> {
  const { postId, title, content, hide = '0' } = params;

  if (!content || content.trim().length === 0) {
    console.warn(`⚠️ 文章 ${postId} 内容为空，跳过向量化`);
    return { insertedCount: 0, chunkCount: 0 };
  }

  try {
    // 1. 删除旧向量
    await deleteVectorsByPostId(postId);

    // 2. 文本切片（使用修复后的 text-splitter）
    const chunks = splitMarkdownIntoChunks(content, {
      chunkSize: 500,
      chunkOverlap: 100,
      minChunkSize: 100,
    });

    if (chunks.length === 0) {
      console.warn(`⚠️ 文章 ${postId} 切片后为空`);
      return { insertedCount: 0, chunkCount: 0 };
    }

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

    console.log(`✅ 文章 ${postId} 向量化成功: ${insertedCount} 个向量`);

    return {
      insertedCount,
      chunkCount: chunks.length,
    };
  } catch (error) {
    console.error(`❌ 文章 ${postId} 向量化失败:`, error);
    throw error;
  }
}
```

**关键改进**：
- 移除 TbPostChunk 数据库操作
- 移除 Hash 对比逻辑
- 移除版本化管理
- 同步执行，失败时抛出异常

---

### 阶段 3：修改文章服务层（关键）

**目标**：同步执行向量化，失败时回滚文章更新

**修改文件**：`src/services/post.ts`

**变更内容**：

1. **修改 `createPost` 函数**
   - 创建文章后同步执行向量化
   - 向量化失败时回滚文章创建

2. **修改 `updatePost` 函数**（第 323-435 行）
   ```typescript
   // 当前代码（第 410-432 行）需要修改
   // 异步执行向量化 → 改为同步执行

   const updatedPost = await prisma.tbPost.update({
     where: { id },
     data: updateData,
   });

   revalidatePath(updatedPost.path!);

   // 如果内容有更新，同步执行全量向量化
   if (hasContentUpdate && updatedPost.content) {
     try {
       await simpleEmbedPost({
         postId: id,
         title: updatedPost.title || '',
         content: updatedPost.content,
         hide: updatedPost.hide || '0',
       });
     } catch (error) {
       // 向量化失败，回滚文章更新
       console.error(`❌ 向量化失败，回滚文章 ${id} 的更新:`, error);
       await prisma.tbPost.update({
         where: { id },
         data: { content: existingPost.content }, // 恢复原内容
       });
       throw new Error('向量化失败，文章更新已回滚');
     }
   }

   return serializePost(updatedPost);
   ```

3. **修改 `deletePost` 函数**
   - 删除向量（异步，不阻塞）

---

### 阶段 4：修改 API 路由

**修改文件**：
- `src/app/api/post/create/route.ts`
- `src/app/api/post/[id]/route.ts`

**变更内容**：

```typescript
// 创建文章 API
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // 1. 创建文章
    const post = await createPost(data);

    // 2. 同步向量化（已在 createPost 内部完成）

    return successResponse(post);
  } catch (error) {
    // 向量化失败会自动回滚文章创建
    return errorResponse(error.message);
  }
}
```

---

### 阶段 5：清理旧代码（可选）

**删除文件**：
- `src/services/embedding/incremental-embedder.ts`
- `src/services/embedding/chunk-normalizer.ts`
- `src/services/embedding/chunk-id-generator.ts`

**删除数据库表**（可选，保留用于历史数据）：
- `TbPostChunk`（如果确认不再需要）
- `TbPostVersion`（如果仅用于向量化）

**迁移脚本**（如果删除表）：
```typescript
// scripts/migrate-vectors.ts
// 验证 Qdrant 中的向量数据，确认无需迁移
// 因为向量数据独立于 MySQL，直接删除表即可
```

---

### 阶段 6：测试和验证

**测试步骤**：

1. **单元测试**：文本切片
   ```bash
   pnpm exec ts-node -e "
   import { splitMarkdownIntoChunks } from './src/services/embedding/text-splitter';
   const markdown = '# 标题\n\`\`\`js\nconsole.log(1);\n\`\`\`\n\n这是 \`代码\` 示例';
   const chunks = splitMarkdownIntoChunks(markdown);
   console.log('Chunk text:', chunks[0].text);
   console.log('Contains code:', chunks[0].text.includes('代码'));
   "
   ```

2. **集成测试**：向量化
   ```bash
   # 创建测试文章
   curl -X POST http://localhost:3000/api/post/create \
     -H "Content-Type: application/json" \
     -d '{"title": "测试", "content": "```typescript\nconst a = 1;\n```"}'

   # 检查向量是否生成
   # 使用 Qdrant REST API 验证
   ```

3. **端到端测试**：搜索功能
   ```bash
   # 使用搜索功能验证向量质量
   ```

---

## 关键文件清单

### 需要修改的文件

| 文件路径 | 变更类型 | 优先级 |
|---------|---------|--------|
| `src/services/embedding/text-splitter.ts` | 修改文本清理逻辑 | P0（高） |
| `src/services/embedding/simple-embedder.ts` | 新建文件 | P0（高） |
| `src/services/post.ts` | 修改 createPost/updatePost | P0（高） |
| `src/app/api/post/create/route.ts` | 修改错误处理 | P1（中） |
| `src/app/api/post/[id]/route.ts` | 修改错误处理 | P1（中） |

### 可以删除的文件

| 文件路径 | 说明 |
|---------|------|
| `src/services/embedding/incremental-embedder.ts` | 增量更新逻辑 |
| `src/services/embedding/chunk-normalizer.ts` | 内容规范化 |
| `src/services/embedding/chunk-id-generator.ts` | Chunk ID 生成 |

---

## 风险和缓解措施

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 向量化失败导致文章更新失败 | 高 | 提供 `/api/post/[id]/re-embed` 手动触发端点 |
| API 调用时间增加（约 1 秒） | 中 | 批量处理已优化，可接受 |
| 代码块搜索质量可能下降 | 低 | 改进切片逻辑，单独处理代码块 |
| Qdrant 连接失败 | 中 | 添加重试机制（已有） |
| 删除 TbPostChunk 表导致数据丢失 | 高 | **先保留表**，确认稳定后再删除 |

---

## 性能评估

### 当前方案（增量更新）
- 文章更新时间：~100ms（仅数据库操作）
- 向量化时间：异步，用户无感知
- 代码复杂度：1500+ 行

### 新方案（全量更新）
- 文章更新时间：~1.1s（数据库 + 向量化）
- 向量化时间：同步，用户需等待
- 代码复杂度：~500 行

**结论**：性能影响可接受（增加约 1 秒），但大幅提高可靠性和可维护性。

---

## 验证清单

- [ ] 文本切片保留代码块和行内代码
- [ ] 向量化同步执行，失败时明确反馈
- [ ] 文章更新失败时自动回滚
- [ ] 搜索功能正常工作
- [ ] Qdrant 中数据完整（chunk_text 包含完整内容）
- [ ] 错误日志详细，便于调试
- [ ] 手动触发向量化的 API 端点可用

---

## 后续优化（可选）

1. **添加手动触发端点**
   ```typescript
   // src/app/api/post/[id]/re-embed/route.ts
   // 允许管理员手动重新向量化文章
   ```

2. **向量化进度反馈**
   - 使用 WebSocket 或 SSE 向前端推送进度
   - 改善用户体验

3. **批量重新向量化**
   ```typescript
   // scripts/re-embed-all.ts
   // 遍历所有文章，重新生成向量
   ```

4. **代码块智能处理**
   - 提取代码注释和变量名作为描述
   - 提高代码相关搜索的准确度
