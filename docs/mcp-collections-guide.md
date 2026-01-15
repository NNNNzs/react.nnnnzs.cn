# MCP 合集功能使用指南

## 功能概述

在博客的 MCP (Model Context Protocol) 功能中添加了合集支持，现在可以通过 MCP 工具创建文章时直接添加到合集，或更新文章的合集关联。

## 新增的 MCP 功能

### 1. 新增资源：blog://collections

**用途**：查询所有可用的合集列表

**使用示例**：
```
请读取 blog://collections 资源，查看我有哪些合集
```

**返回格式**：
```
ID: 1 | Slug: nextjs-series | Title: Next.js 系列教程 | Articles: 5
ID: 2 | Slug: react-hooks | Title: React Hooks 深度解析 | Articles: 3
```

### 2. create_article 工具增强

**新增参数**：
- `collections`: 逗号分隔的合集 ID 或 slug

**使用示例**：

#### 使用合集 ID
```
创建一篇新文章，标题是"Next.js 14 新特性"，内容是"...", 并添加到 ID 为 1 的合集
```

#### 使用合集 Slug
```
创建一篇关于 React Server Components 的文章，并添加到 "react-advanced" 合集
```

#### 添加到多个合集
```
创建文章并添加到合集 1 和合集 2
```

### 3. update_article 工具增强

**新增参数**：
- `add_to_collections`: 逗号分隔的合集 ID 或 slug，将文章添加到这些合集
- `remove_from_collections`: 逗号分隔的合集 ID 或 slug，从这些合集移除文章

**使用示例**：

#### 添加到合集
```
更新文章 ID 123，将其添加到 "nextjs-series" 合集
```

#### 从合集移除
```
更新文章 ID 123，从合集 1 中移除
```

#### 同时添加和移除
```
把文章 456 从合集 1 移除，并添加到合集 2
```

## 完整工作流程

### 场景 1: 创建新文章并添加到合集

**步骤**：
1. 先查看可用合集
   ```
   读取 blog://collections 资源
   ```

2. 创建文章并添加到合集
   ```
   创建文章：
   - 标题："Next.js App Router 完全指南"
   - 内容："..."
   - 标签："nextjs,react"
   - 合集："nextjs-series"（使用 slug）
   ```

### 场景 2: 将现有文章添加到合集

**步骤**：
1. 查看可用合集
   ```
   读取 blog://collections 资源
   ```

2. 更新文章，添加到合集
   ```
   更新文章 ID 123，添加到合集 1
   ```

### 场景 3: 管理文章的合集关联

**步骤**：
1. 查看文章当前所在的合集
   ```
   查询文章 ID 123 的详情
   ```

2. 调整合集关联
   ```
   更新文章 ID 123：
   - 从合集 1 移除
   - 添加到合集 2 和合集 3
   ```

## 最佳实践

### 1. 使用 ID 还是 Slug？

**推荐使用 ID**：
- ✅ ID 是数字，更精确
- ✅ ID 不会改变
- ✅ 性能更好（直接查询）

**Slug 使用场景**：
- ✅ 当你不记得 ID 但记得 slug 时
- ✅ slug 更易读（适合人类阅读）

### 2. 先查询再操作

```
# 好的做法
1. 读取 blog://collections 资源
2. 确认合集 ID 或 slug
3. 使用正确的标识符创建/更新文章

# 不推荐
1. 直接使用猜测的 ID 或 slug（可能不存在）
```

### 3. 错误处理

- 如果添加到不存在的合集，操作会静默失败（不影响文章创建/更新）
- 建议先查询合集列表，确保合集存在

## API 变更详情

### 导入的 Service

```typescript
import { getCollectionList } from '@/services/collection';
import { addPostsToCollection, removePostsFromCollection } from '@/services/collection';
```

### create_article 参数

```typescript
{
  title: string;
  content: string;
  category?: string;
  tags?: string;  // 逗号分隔的标签
  collections?: string;  // 新增：逗号分隔的合集 ID 或 slug
  description?: string;
  cover?: string;
  hide?: string;
}
```

### update_article 参数

```typescript
{
  id: number;
  title?: string;
  content?: string;
  category?: string;
  tags?: string;
  description?: string;
  cover?: string;
  hide?: string;
  add_to_collections?: string;  // 新增：添加到合集
  remove_from_collections?: string;  // 新增：从合集移除
}
```

### blog://collections 资源

```typescript
{
  uri: "blog://collections",
  mimeType: "text/plain",
  text: "ID: 1 | Slug: nextjs-series | Title: Next.js 系列教程 | Articles: 5\n..."
}
```

## 技术实现

### 合集解析逻辑

```typescript
// 判断是 ID 还是 slug
const collectionId = /^\d+$/.test(identifier) ? parseInt(identifier, 10) : null;

if (collectionId) {
  // 使用 ID 直接添加
  await addPostsToCollection(collectionId, [postId]);
} else {
  // 使用 slug 查询后再添加
  const collections = await getCollectionList({ pageNum: 1, pageSize: 100 });
  const collection = collections.record.find(c => c.slug === identifier);
  if (collection) {
    await addPostsToCollection(collection.id, [postId]);
  }
}
```

### 错误处理

- 合集关联失败不会影响文章创建/更新
- 错误会记录到控制台，方便调试
- 使用 try-catch 包裹每个合集操作

## 测试示例

### 测试 1: 创建文章并添加到单个合集

```
请创建一篇文章：
- 标题：测试文章
- 内容：这是一篇测试文章
- 添加到合集 ID 1
```

### 测试 2: 创建文章并添加到多个合集

```
创建文章并添加到合集 1, 2, 3
```

### 测试 3: 更新文章的合集关联

```
把文章 ID 123 从合集 1 移除，添加到合集 2
```

### 测试 4: 使用 slug 而不是 ID

```
创建文章并添加到 "nextjs-series" 合集
```

## 相关文件

- **MCP Route**: `src/app/api/mcp/route.ts`
- **Collection Service**: `src/services/collection.ts`
- **Collection DTO**: `src/dto/collection.dto.ts`

## 注意事项

1. **合集必须存在**：确保使用的 ID 或 slug 对应的合集已创建
2. **权限要求**：需要通过 MCP 认证（Bearer Token 或其他方式）
3. **性能考虑**：使用 slug 时需要先查询列表，性能略低于直接使用 ID
4. **批量操作**：支持一次性添加到多个合集（逗号分隔）

## 未来可能的增强

- [ ] 支持创建新合集（如果合集不存在）
- [ ] 支持在 MCP 中查看文章所属的合集
- [ ] 支持设置文章在合集中的排序
- [ ] 支持批量更新多篇文章的合集关联
