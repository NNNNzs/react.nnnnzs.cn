# 文本切片策略

> **状态**: ✅ 已实施
> **创建日期**: 2026-01-17
> **相关文档**: [向量化总览](./overview.md) | [向量存储](./storage.md)

## 概述

文本切片是向量化系统的核心组件，负责将 Markdown 格式的文章内容智能分割成适合向量化的小块。切片策略直接影响向量检索的质量。

### 核心特性

- **语义分块**：按 Markdown 标题结构（# ## ###）分割，保持语义完整性
- **智能内容清理**：保留代码块标记和行内代码内容，移除冗余语法
- **可配置大小**：支持自定义块大小、重叠和最小尺寸
- **边界保护**：避免在句子中间分割，添加重叠区域保持上下文

## 文件位置

**实现文件**：`src/services/embedding/text-splitter.ts`

## 切片策略

### 按标题分块

优先按照 Markdown 标题层级（# ## ### ####）进行分块，每个标题及其下属内容作为一个独立块。

**适用场景**：
- 结构良好的技术文档
- 有明确章节划分的文章
- 需要语义完整性的内容

### 普通文本分块

当没有标题结构时，按字符数均匀分割，在段落边界处切分。

**适用场景**：
- 纯文本内容
- 缺少标题结构的文章
- 连续的长段落

### 代码块处理

代码块采用特殊处理：
- 提取语言标记和第一行注释
- 代码块单独作为一个 chunk
- 避免在代码中间分割

## 配置参数

```typescript
// src/services/embedding/text-splitter.ts

export interface ChunkConfig {
  chunkSize: number;      // 每个片段的最大字符数（默认 500）
  chunkOverlap: number;   // 片段之间的重叠字符数（默认 100）
  minChunkSize: number;   // 最小片段字符数（默认 100）
}

const DEFAULT_CONFIG: ChunkConfig = {
  chunkSize: 500,
  chunkOverlap: 100,
  minChunkSize: 100,
};
```

### 参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `chunkSize` | 500 | 单个 chunk 的最大字符数 |
| `chunkOverlap` | 100 | 相邻 chunk 之间的重叠字符数，保持上下文连续性 |
| `minChunkSize` | 100 | 最小 chunk 大小，避免生成过短的片段 |

## 实现细节

### 1. Markdown 标题分块

```typescript
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
```

### 2. 内容清理

```typescript
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

### 3. 普通文本分割

```typescript
/**
 * 普通文本分割（在段落边界分割）
 */
export function splitTextIntoChunks(
  text: string,
  config: ChunkConfig = {}
): Chunk[] {
  const chunks: Chunk[] = [];
  const { chunkSize = 500, chunkOverlap = 100 } = config;

  let start = 0;
  while (start < text.length) {
    let end = start + chunkSize;

    // 如果不是结尾，尝试在段落边界分割
    if (end < text.length) {
      // 查找最近的换行符
      const lastNewline = text.lastIndexOf('\n\n', end);
      if (lastNewline > start) {
        end = lastNewline;
      }
    }

    chunks.push({
      text: text.slice(start, end).trim(),
      metadata: {},
    });

    // 移动到下一个位置，保留重叠
    start = end - chunkOverlap;
  }

  return chunks;
}
```

## 使用示例

### 基础用法

```typescript
import { splitMarkdownIntoChunks } from '@/services/embedding/text-splitter';

const markdown = `
# Next.js 简介

Next.js 是一个 React 框架。

## 核心特性

- SSR 支持
- 静态导出
- API 路由

\`\`\`typescript
const App = () => {
  return <div>Hello</div>;
};
\`\`\`
`;

const chunks = splitMarkdownIntoChunks(markdown, {
  chunkSize: 500,
  chunkOverlap: 100,
  minChunkSize: 100,
});

console.log(`生成了 ${chunks.length} 个片段`);
chunks.forEach((chunk, index) => {
  console.log(`Chunk ${index}:`, chunk.text);
});
```

### 与向量化集成

```typescript
import { splitMarkdownIntoChunks } from '@/services/embedding/text-splitter';
import { embedTexts } from '@/services/embedding/embedding';

async function vectorizeArticle(content: string) {
  // 1. 文本切片
  const chunks = splitMarkdownIntoChunks(content);

  // 2. 批量生成向量
  const embeddings = await embedTexts(
    chunks.map((c) => c.text)
  );

  // 3. 返回向量数据
  return chunks.map((chunk, index) => ({
    text: chunk.text,
    embedding: embeddings[index],
  }));
}
```

## 切片质量优化

### 1. 避免信息丢失

**问题**：过度清理导致代码块、行内代码等关键内容丢失

**解决**：
- 代码块保留语言标记 `[TypeScript块]`
- 行内代码保留内容 `const` 而非 `` `const` ``
- 链接保留文本而非移除

### 2. 保持上下文连续性

**问题**：在句子中间分割导致语义不完整

**解决**：
- 在段落边界（`\n\n`）处分割
- 添加重叠区域（默认 100 字符）
- 避免在代码块中间分割

### 3. 控制 chunk 大小

**问题**：chunk 过大导致向量化质量下降，过小导致碎片化

**解决**：
- 合理设置 `chunkSize`（默认 500）
- 设置 `minChunkSize`（默认 100）避免过短
- 根据内容类型调整参数

## 性能考虑

### 批量处理

- 切片操作是纯 CPU 计算，性能开销小
- 建议批量处理多个文章，减少重复调用

### 缓存策略

- 对于相同内容，可以缓存切片结果
- 使用内容哈希作为缓存键

## 测试验证

### 单元测试

```bash
pnpm test text-splitter
```

### 手动测试

```bash
pnpm exec ts-node -e "
import { splitMarkdownIntoChunks } from './src/services/embedding/text-splitter';

const markdown = '# 测试\n\`\`\`typescript\nconst a = 1;\n\`\`\`\n\n这是 \`代码\` 示例';
const chunks = splitMarkdownIntoChunks(markdown);

console.log('Chunk text:', chunks[0].text);
console.log('Contains code:', chunks[0].text.includes('代码'));
"
```

## 未来改进

1. **智能边界检测**
   - 使用 NLP 模型识别句子边界
   - 在语义完整处分割

2. **代码块智能处理**
   - 提取函数名和注释
   - 生成代码摘要

3. **自适应切片**
   - 根据内容类型自动调整参数
   - 代码使用更小的 chunk

## 参考资料

- [文本分割最佳实践](https://python.langchain.com/docs/modules/data_connection/document_transformers/)
- [Markdown 语法规范](https://commonmark.org/)
- [向量搜索设计](../search/semantic-search.md)

---

**文档版本**：v1.0
**创建日期**：2026-01-17
**最后更新**：2026-03-12
**状态**：✅ 已实现
