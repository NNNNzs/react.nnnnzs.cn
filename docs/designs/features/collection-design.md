# 博客合集功能设计文档

> **本文档定位**: 技术设计文档 - 说明合集功能的设计原理和实现方案
>
> **开发实施规范**详见:
> - [前端开发规范](../rules/frontend.md) - 前端组件和页面实现
> - [后端开发规范](../rules/backend.md) - API 路由和服务层
> - [数据库开发规范](../rules/database.md) - 数据模型定义

## 一、需求概述

为现有的博客系统增加**合集（Collection）**功能，允许用户将相关的文章组织成合集，每个合集可以有独立的页面展示。

### 核心功能
- **合集列表页**：展示所有合集
- **合集详情页**：展示单个合集的详细信息和包含的文章
- **合集管理**：在管理后台创建、编辑、删除合集
- **文章关联**：将文章添加到合集中
- **前端展示**：在文章详情页显示所属合集信息

---

## 二、数据库设计

### 2.1 新增数据表

#### `tb_collection` - 合集表

```prisma
model TbCollection {
  id          Int       @id @default(autoincrement())
  title       String    @db.VarChar(255)    // 合集标题
  slug        String    @unique @db.VarChar(255) // URL路径，如 /collections/nextjs-series
  description String?   @db.VarChar(1000)   // 合集描述（支持Markdown）
  cover       String?   @db.VarChar(255)    // 封面图URL
  background  String?   @db.VarChar(255)    // 背景图URL
  color       String?   @db.VarChar(20)     // 主题色，如 #2563eb

  // 统计信息（冗余字段，提高查询性能）
  article_count Int     @default(0)       // 文章数量
  total_views   Int     @default(0)       // 总浏览量
  total_likes   Int     @default(0)       // 总点赞数

  // 状态字段
  status      Int       @default(1)       // 状态：1-正常，0-隐藏
  is_delete   Int       @default(0)       // 逻辑删除：0-未删除，1-已删除

  // 时间戳
  created_at  DateTime  @default(now())
  updated_at  DateTime  @updatedAt

  // 关联关系
  articles    TbPost[] // 该合集包含的文章（通过中间表）
  creator     TbUser?  @relation(fields: [created_by], references: [id])
  created_by  Int?      // 创建人ID

  @@index([status])
  @@index([created_at])
  @@map("tb_collection")
}
```

#### `tb_collection_post` - 合集文章关联表（中间表）

```prisma
model TbCollectionPost {
  id            Int       @id @default(autoincrement())
  collection_id Int       // 合集ID
  post_id       Int       // 文章ID
  sort_order    Int       @default(0)  // 排序序号，用于控制合集内文章顺序

  created_at    DateTime  @default(now())

  // 关联关系
  collection    TbCollection @relation(fields: [collection_id], references: [id])
  post          TbPost       @relation(fields: [post_id], references: [id])

  @@unique([collection_id, post_id]) // 防止重复关联
  @@index([collection_id, sort_order])
  @@map("tb_collection_post")
}
```

#### `tb_collection_tag` - 合集标签表（可选，增强分类能力）

```prisma
model TbCollectionTag {
  id            Int       @id @default(autoincrement())
  tag           String    @unique @db.VarChar(50)  // 标签名称
  collection_count Int    @default(0)              // 使用该标签的合集数量

  @@map("tb_collection_tag")
}
```

### 2.2 现有数据表修改

#### `tb_post` 表增加字段

```prisma
// 在现有 TbPost 模型中添加（可选）
model TbPost {
  // ... 现有字段 ...

  collection_id  Int?     // 合集ID（与中间表冗余，用于快速查询）

  // 关联关系
  collection     TbCollection? @relation(fields: [collection_id], references: [id])

  // 更新映射
  @@map("tb_post")
}
```

**注意**：`collection_id` 字段是可选的冗余字段。主要通过 `tb_collection_post` 中间表维护关系，但添加此字段可以：
1. 快速查询文章所属的主要合集
2. 在文章列表页直接显示所属合集
3. 简化单篇文章的合集查询

---

## 三、API 接口设计

### 3.1 前端展示 API

#### 1. 获取合集列表
```
GET /api/collections
参数：
  - page: 页码（默认1）
  - pageSize: 每页数量（默认10）

响应：
{
  "status": true,
  "data": {
    "record": [
      {
        "id": 1,
        "title": "Next.js 系列",
        "slug": "nextjs-series",
        "description": "从入门到精通的 Next.js 系列教程",
        "cover": "https://...",
        "background": "https://...",
        "color": "#2563eb",
        "article_count": 8,
        "total_views": 1234,
        "total_likes": 56,
        "created_at": "2024-01-15T10:00:00Z"
      }
    ],
    "total": 10,
    "pageNum": 1,
    "pageSize": 10
  }
}
```

#### 2. 获取单个合集详情
```
GET /api/collections/[slug]
参数：无

响应：
{
  "status": true,
  "data": {
    "id": 1,
    "title": "Next.js 系列",
    "slug": "nextjs-series",
    "description": "从入门到精通的 Next.js 系列教程",
    "cover": "https://...",
    "background": "https://...",
    "color": "#2563eb",
    "article_count": 8,
    "total_views": 1234,
    "total_likes": 56,
    "created_at": "2024-01-15T10:00:00Z",
    "articles": [
      {
        "id": 101,
        "title": "Next.js 基础配置",
        "path": "/2024/01/15/nextjs-basic",
        "description": "介绍 Next.js 的基础配置...",
        "cover": "https://...",
        "date": "2024-01-15T10:00:00Z",
        "visitors": 123,
        "likes": 12
      }
    ]
  }
}
```

#### 3. 获取文章的所属合集
```
GET /api/posts/[id]/collections
参数：无

响应：
{
  "status": true,
  "data": [
    {
      "id": 1,
      "title": "Next.js 系列",
      "slug": "nextjs-series",
      "cover": "https://...",
      "sort_order": 0
    }
  ]
}
```

### 3.2 管理后台 API

#### 1. 创建合集
```
POST /api/admin/collections
Body:
{
  "title": "Next.js 系列",
  "slug": "nextjs-series",
  "description": "从入门到精通的 Next.js 系列教程",
  "cover": "https://...",
  "background": "https://...",
  "color": "#2563eb"
}

响应：
{
  "status": true,
  "message": "合集创建成功",
  "data": { "id": 1, ... }
}
```

#### 2. 更新合集
```
PUT /api/admin/collections/[id]
Body: 同创建接口

响应：
{
  "status": true,
  "message": "合集更新成功"
}
```

#### 3. 删除合集（软删除）
```
DELETE /api/admin/collections/[id]

响应：
{
  "status": true,
  "message": "合集删除成功"
}
```

#### 4. 获取合集列表（管理后台）
```
GET /api/admin/collections
参数：同前端列表接口

响应：增加管理字段
{
  "status": true,
  "data": {
    "record": [
      {
        // ... 基础字段 ...
        "status": 1,
        "is_delete": 0,
        "created_by": 1,
        "creator": { "id": 1, "nickname": "Admin" }
      }
    ]
  }
}
```

#### 5. 文章关联到合集
```
POST /api/admin/collections/[id]/posts
Body:
{
  "post_ids": [101, 102, 103],
  "sort_orders": [0, 1, 2]  // 可选，指定排序
}

响应：
{
  "status": true,
  "message": "文章关联成功"
}
```

#### 6. 从合集移除文章
```
DELETE /api/admin/collections/[id]/posts
Body:
{
  "post_ids": [101, 102]
}

响应：
{
  "status": true,
  "message": "文章已从合集中移除"
}
```

#### 7. 调整合集内文章顺序
```
PUT /api/admin/collections/[id]/sort
Body:
{
  "orders": [
    { "post_id": 101, "sort_order": 2 },
    { "post_id": 102, "sort_order": 0 },
    { "post_id": 103, "sort_order": 1 }
  ]
}

响应：
{
  "status": true,
  "message": "排序调整成功"
}
```

---

## 四、前端页面改造

### 4.1 新增页面

#### 1. 合集列表页 (`/collections/page.tsx`)
- **路径**：`/collections`
- **功能**：
  - 展示所有合集的卡片式列表
  - 每张卡片显示封面、标题、描述、文章数量、浏览量
  - 支持分页
  - 搜索功能（可选）

**设计参考**：
```tsx
// 与 /categories 和 /tags 页面风格一致
<Banner title="合集" subtitle="按合集浏览文章" />

<div className="container mx-auto px-4 py-8">
  <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
    {/* 合集卡片 */}
    <Link href={`/collections/${slug}`} className="group">
      <div className="relative overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-all">
        {/* 背景图 */}
        <img src={cover} alt={title} className="w-full h-48 object-cover" />

        {/* 遮罩层 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

        {/* 内容 */}
        <div className="absolute bottom-0 p-4 text-white">
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="text-sm opacity-90 line-clamp-2">{description}</p>
          <div className="mt-2 text-xs opacity-80">
            📚 {article_count} 篇 · 👁️ {total_views}
          </div>
        </div>
      </div>
    </Link>
  </div>
</div>
```

#### 2. 合集详情页 (`/collections/[slug]/page.tsx`)
- **路径**：`/collections/[slug]`
- **功能**：
  - 展示合集详情（封面、标题、描述、统计）
  - 按排序顺序展示合集内的所有文章
  - 文章卡片显示在合集中的序号

**设计参考**：
```tsx
// 页面结构
<Banner
  title={collection.title}
  subtitle={collection.description}
  background={collection.background}
  customStyle={{ backgroundColor: collection.color }}
>

<div className="container mx-auto px-4 py-8">
  {/* 统计信息栏 */}
  <div className="flex gap-6 mb-8 p-4 bg-gray-50 rounded-lg">
    <span>📚 {collection.article_count} 篇文章</span>
    <span>👁️ {collection.total_views} 次浏览</span>
    <span>❤️ {collection.total_likes} 个赞</span>
  </div>

  {/* 文章列表 */}
  <div className="space-y-4">
    {articles.map((article, index) => (
      <Link key={article.id} href={article.path}>
        <div className="flex items-center gap-4 p-4 bg-white rounded-lg hover:shadow-md transition-all">
          <span className="text-2xl font-bold text-gray-400 w-8 text-center">
            {String(index + 1).padStart(2, '0')}
          </span>
          <img src={article.cover} className="w-20 h-12 object-cover rounded" />
          <div className="flex-1">
            <h3 className="font-semibold">{article.title}</h3>
            <p className="text-sm text-gray-500 line-clamp-1">{article.description}</p>
          </div>
          <div className="text-sm text-gray-400">
            {dayjs(article.date).format('YYYY-MM-DD')}
          </div>
        </div>
      </Link>
    ))}
  </div>
</div>
```

#### 3. 文章详情页显示所属合集
在现有的文章详情页 (`/[year]/[month]/[date]/[title]/page.tsx`) 中增加：

```tsx
// 在文章标题下方或侧边栏
{articleCollections && articleCollections.length > 0 && (
  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
    <div className="flex items-center gap-2 mb-2">
      <BookOutlined />
      <span className="font-semibold">所属合集</span>
    </div>
    <div className="flex flex-wrap gap-2">
      {articleCollections.map(collection => (
        <Link
          key={collection.id}
          href={`/collections/${collection.slug}`}
          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
        >
          {collection.title}
        </Link>
      ))}
    </div>
  </div>
)}
```

### 4.2 管理后台改造

#### 1. 合集管理页 (`/c/collections/page.tsx`)
- **路径**：`/c/collections`
- **功能**：
  - 合集列表表格（类似文章管理）
  - 创建、编辑、删除操作
  - 批量操作（可选）

#### 2. 合集编辑页 (`/c/collections/[id]/page.tsx`)
- **路径**：`/c/collections/[id]`
- **功能**：
  - 基本信息编辑（标题、slug、描述、图片链接、主题色）
  - 文章关联管理：
    - 可选择文章添加到合集
    - 拖拽排序
    - 从合集中移除文章

#### 3. 文章编辑页增强 (`/c/edit/[id]/page.tsx`)
在现有编辑页面增加合集选择器：
```tsx
<Select
  mode="multiple"
  placeholder="选择所属合集"
  value={selectedCollections}
  onChange={setSelectedCollections}
  options={collectionOptions}
/>
```

#### 4. 管理后台导航
在 `/c/layout.tsx` 的菜单中增加：
```tsx
<Menu.Item key="collections" icon={<BookOutlined />}>
  <Link href="/c/collections">合集管理</Link>
</Menu.Item>
```

---

## 五、服务层设计

### 5.1 新增服务文件

#### `src/services/collection.ts`
```typescript
import { getPrisma } from '@/lib/prisma';
import { TbCollection, TbCollectionPost } from '@/generated/prisma-client';

// 序列化函数
function serializeCollection(collection: TbCollection) {
  return {
    ...collection,
    created_at: collection.created_at?.toISOString() || null,
    updated_at: collection.updated_at?.toISOString() || null,
  };
}

// 获取合集列表
export async function getCollectionList(params: {
  pageSize: number;
  pageNum: number;
  status?: number;
}): Promise<{ record: any[]; total: number; pageNum: number; pageSize: number }> {
  const { pageSize, pageNum, status = 1 } = params;
  const prisma = await getPrisma();

  const [data, total] = await Promise.all([
    prisma.tbCollection.findMany({
      where: {
        status,
        is_delete: 0,
      },
      orderBy: { created_at: 'desc' },
      take: pageSize,
      skip: (pageNum - 1) * pageSize,
    }),
    prisma.tbCollection.count({
      where: { status, is_delete: 0 },
    }),
  ]);

  return {
    record: data.map(serializeCollection),
    total,
    pageNum,
    pageSize,
  };
}

// 根据slug获取合集详情及文章
export async function getCollectionBySlug(slug: string) {
  const prisma = await getPrisma();

  const collection = await prisma.tbCollection.findFirst({
    where: { slug, status: 1, is_delete: 0 },
    include: {
      // 通过中间表关联文章，按 sort_order 排序
      articles: {
        select: {
          id: true,
          title: true,
          path: true,
          description: true,
          cover: true,
          date: true,
          visitors: true,
          likes: true,
          TbCollectionPost: {
            select: { sort_order: true }
          }
        },
        orderBy: {
          TbCollectionPost: { sort_order: 'asc' }
        }
      }
    }
  });

  if (!collection) return null;

  // 处理文章数据，提取 sort_order
  const articles = collection.articles.map((article: any) => ({
    ...article,
    sort_order: article.TbCollectionPost?.sort_order || 0,
    date: article.date?.toISOString(),
    TbCollectionPost: undefined
  }));

  return { ...serializeCollection(collection), articles };
}

// 创建合集
export async function createCollection(data: Partial<TbCollection>) {
  const prisma = await getPrisma();

  const collection = await prisma.tbCollection.create({
    data: {
      title: data.title!,
      slug: data.slug!,
      description: data.description || null,
      cover: data.cover || null,
      background: data.background || null,
      color: data.color || null,
      created_by: data.created_by || null,
    }
  });

  return serializeCollection(collection);
}

// 更新合集
export async function updateCollection(id: number, data: Partial<TbCollection>) {
  const prisma = await getPrisma();

  const collection = await prisma.tbCollection.update({
    where: { id },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.slug && { slug: data.slug }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.cover !== undefined && { cover: data.cover }),
      ...(data.background !== undefined && { background: data.background }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.status !== undefined && { status: data.status }),
    }
  });

  return serializeCollection(collection);
}

// 删除合集（软删除）
export async function deleteCollection(id: number) {
  const prisma = await getPrisma();

  await prisma.tbCollection.update({
    where: { id },
    data: { is_delete: 1 }
  });

  return true;
}

// 将文章添加到合集
export async function addPostsToCollection(
  collectionId: number,
  postIds: number[],
  sortOrders?: number[]
) {
  const prisma = await getPrisma();

  // 开始事务
  const result = await prisma.$transaction(async (tx) => {
    // 先查询现有文章，避免重复
    const existing = await tx.tbCollectionPost.findMany({
      where: {
        collection_id: collectionId,
        post_id: { in: postIds }
      },
      select: { post_id: true }
    });

    const existingIds = existing.map(e => e.post_id);
    const newPostIds = postIds.filter(id => !existingIds.includes(id));

    // 批量创建关联
    const createData = newPostIds.map((postId, index) => ({
      collection_id: collectionId,
      post_id: postId,
      sort_order: sortOrders?.[index] ?? 0
    }));

    if (createData.length > 0) {
      await tx.tbCollectionPost.createMany({ data: createData });
    }

    // 更新合集的 article_count
    const count = await tx.tbCollectionPost.count({
      where: { collection_id: collectionId }
    });

    await tx.tbCollection.update({
      where: { id: collectionId },
      data: { article_count: count }
    });

    return { created: createData.length };
  });

  return result;
}

// 从合集移除文章
export async function removePostsFromCollection(
  collectionId: number,
  postIds: number[]
) {
  const prisma = await getPrisma();

  await prisma.$transaction(async (tx) => {
    await tx.tbCollectionPost.deleteMany({
      where: {
        collection_id: collectionId,
        post_id: { in: postIds }
      }
    });

    // 更新计数
    const count = await tx.tbCollectionPost.count({
      where: { collection_id: collectionId }
    });

    await tx.tbCollection.update({
      where: { id: collectionId },
      data: { article_count: count }
    });
  });

  return true;
}

// 调整合集内文章顺序
export async function updateCollectionOrder(
  collectionId: number,
  orders: { post_id: number; sort_order: number }[]
) {
  const prisma = await getPrisma();

  await prisma.$transaction(
    orders.map(({ post_id, sort_order }) =>
      prisma.tbCollectionPost.updateMany({
        where: { collection_id: collectionId, post_id },
        data: { sort_order }
      })
    )
  );

  return true;
}

// 获取文章所属的合集
export async function getCollectionsByPostId(postId: number) {
  const prisma = await getPrisma();

  const relations = await prisma.tbCollectionPost.findMany({
    where: {
      post_id: postId,
      collection: { status: 1, is_delete: 0 }
    },
    include: {
      collection: {
        select: {
          id: true,
          title: true,
          slug: true,
          cover: true,
          color: true
        }
      }
    },
    orderBy: { sort_order: 'asc' }
  });

  return relations.map(r => ({
    ...r.collection,
    sort_order: r.sort_order
  }));
}

// 增加合集浏览量
export async function incrementCollectionViews(id: number) {
  const prisma = await getPrisma();

  await prisma.tbCollection.update({
    where: { id },
    data: { total_views: { increment: 1 } }
  });

  return true;
}

// 增加合集点赞数
export async function incrementCollectionLikes(id: number) {
  const prisma = await getPrisma();

  await prisma.tbCollection.update({
    where: { id },
    data: { total_likes: { increment: 1 } }
  });

  return true;
}
```

### 5.2 更新现有服务

#### `src/services/post.ts`
增加文章与合集关联的功能：
```typescript
// 在文章查询时，可以选择展开合集信息
export async function getPostWithCollections(postId: number) {
  const post = await getPostById(postId);
  if (!post) return null;

  const collections = await getCollectionsByPostId(postId);

  return { ...post, collections };
}

// 创建文章时关联合集
export async function createPostWithCollections(
  data: Partial<TbPost>,
  collectionIds?: number[]
) {
  // 先创建文章
  const post = await createPost(data);

  // 如果指定了合集，添加关联
  if (collectionIds && collectionIds.length > 0) {
    await addPostsToCollection(
      collectionIds[0],
      [post.id],
      [0] // 默认排序为0
    );
  }

  return post;
}
```

---

## 六、页面路由设计

### 6.1 前端路由
- `/collections` - 合集列表页
- `/collections/[slug]` - 合集详情页
- 在文章详情页显示合集信息

### 6.2 管理后台路由
- `/c/collections` - 合集管理列表
- `/c/collections/[id]` - 合集编辑页
- 在文章编辑页 `/c/edit/[id]` 增加合集选择

### 6.3 API 路由
```
前端 API：
 GET  /api/collections
 GET  /api/collections/[slug]
 GET  /api/posts/[id]/collections
 POST /api/collections/[id]/views  (增加浏览量)
 POST /api/collections/[id]/likes  (点赞)

管理 API：
 GET  /api/admin/collections
 POST /api/admin/collections
 PUT  /api/admin/collections/[id]
 DELETE /api/admin/collections/[id]
 POST /api/admin/collections/[id]/posts
 DELETE /api/admin/collections/[id]/posts
 PUT  /api/admin/collections/[id]/sort
```

---

## 七、前端组件设计

### 7.1 可复用组件

#### `components/CollectionCard.tsx`
```tsx
interface Props {
  collection: {
    id: number;
    title: string;
    slug: string;
    description?: string;
    cover?: string;
    article_count: number;
    total_views: number;
  };
  className?: string;
}

const CollectionCard: React.FC<Props> = ({ collection, className }) => {
  return (
    <Link
      href={`/collections/${collection.slug}`}
      className={`block group ${className}`}
    >
      <div className="relative overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-all">
        {/* 背景图片 */}
        {collection.cover && (
          <img
            src={collection.cover}
            alt={collection.title}
            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}

        {/* 遮罩层 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        {/* 内容 */}
        <div className="absolute bottom-0 p-4 text-white w-full">
          <h3 className="text-lg font-bold mb-1 line-clamp-1">
            {collection.title}
          </h3>
          {collection.description && (
            <p className="text-sm opacity-90 line-clamp-2 mb-2">
              {collection.description}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs opacity-80">
            <span>📚 {collection.article_count} 篇</span>
            <span>👁️ {collection.total_views}</span>
          </div>
        </div>

        {/* Hover 效果 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      </div>
    </Link>
  );
};

export default CollectionCard;
```

#### `components/ArticleInCollectionItem.tsx`
```tsx
interface Props {
  article: {
    id: number;
    title: string;
    path: string;
    description?: string;
    cover?: string;
    date: string;
    sort_order?: number;
  };
  index: number;
  className?: string;
}

const ArticleInCollectionItem: React.FC<Props> = ({ article, index, className }) => {
  return (
    <Link
      href={article.path}
      className={`block group ${className}`}
    >
      <div className="flex items-center gap-4 p-4 bg-white rounded-lg hover:shadow-md hover:bg-gray-50 transition-all">
        {/* 序号 */}
        <span className="text-2xl font-bold text-gray-400 group-hover:text-blue-600 w-8 text-center transition-colors">
          {String(index + 1).padStart(2, '0')}
        </span>

        {/* 封面 */}
        {article.cover && (
          <img
            src={article.cover}
            alt={article.title}
            className="w-20 h-12 object-cover rounded flex-shrink-0"
          />
        )}

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
            {article.title}
          </h3>
          {article.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-1">
              {article.description}
            </p>
          )}
        </div>

        {/* 日期 */}
        <div className="text-sm text-gray-400 flex-shrink-0">
          {dayjs(article.date).format('YYYY-MM-DD')}
        </div>

        {/* 箭头 */}
        <div className="text-gray-300 group-hover:text-gray-600">
          →
        </div>
      </div>
    </Link>
  );
};

export default ArticleInCollectionItem;
```

#### `components/CollectionSelector.tsx` (用于文章编辑)
```tsx
interface Props {
  value?: number[];
  onChange?: (value: number[]) => void;
  disabled?: boolean;
}

const CollectionSelector: React.FC<Props> = ({ value = [], onChange, disabled }) => {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/collections', {
        params: { pageSize: 100, pageNum: 1 }
      });
      if (res.data.status) {
        setCollections(res.data.data.record);
      }
    } finally {
      setLoading(false);
    }
  };

  const options = collections.map(c => ({
    label: c.title,
    value: c.id
  }));

  return (
    <Select
      mode="multiple"
      placeholder="选择所属合集"
      loading={loading}
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
};
```

---

## 八、数据迁移方案

### 8.1 Prisma 迁移脚本

在 `prisma/schema.prisma` 中添加新模型后，生成迁移：

```bash
# 1. 修改 schema.prisma
# 2. 生成迁移
npx prisma migrate dev --name add_collection_features

# 3. 执行迁移
npx prisma migrate deploy
```

### 8.2 手动数据初始化（可选）

创建初始化脚本 `scripts/init-collections.ts`：

```typescript
import { createCollection } from '@/services/collection';

async function initDemoCollection() {
  // 创建演示合集
  await createCollection({
    title: 'Next.js 系列教程',
    slug: 'nextjs-series',
    description: '从入门到精通的 Next.js 系列教程，涵盖基础配置、路由、状态管理等核心内容。',
    cover: 'https://static.nnnnzs.cn/bing/20240115.png',
    background: 'https://static.nnnnzs.cn/bing/20240115.png',
    color: '#2563eb',
    created_by: 1,
  });

  console.log('演示合集创建完成');
}

initDemoCollection().catch(console.error);
```

---

## 九、性能优化建议

### 9.1 数据库索引
```sql
-- 在 Prisma schema 中已包含，确保以下索引
- @@index([status])
- @@index([created_at])
- @@unique([collection_id, post_id])
- @@index([collection_id, sort_order])
```

### 9.2 查询优化
1. **批量预加载**：在合集列表页，使用 `include` 一次性获取文章计数
2. **分页加载**：合集详情页的文章列表支持分页
3. **缓存策略**：
   - 使用 `revalidate = 60` 缓存静态页面
   - API 返回增加 `Cache-Control` 头

### 9.3 前端优化
1. **图片懒加载**：封面图使用 `loading="lazy"`
2. **无限滚动**：合集内文章较多时，考虑无限滚动
3. **骨架屏**：数据加载时显示骨架屏

---

## 十、安全考虑

### 10.1 输入验证
- **slug**：只允许字母、数字、连字符
- **title**：长度限制 1-255 字符
- **description**：长度限制 1-1000 字符

### 10.2 权限控制
- **创建/编辑/删除**：仅管理员可操作
- **查看**：所有人可查看（status=1 且 is_delete=0）
- **文章关联**：仅管理员可操作

### 10.3 防止注入
- 所有用户输入参数使用参数化查询（Prisma 已处理）
- XSS 防护：使用 `textContent` 或转义 HTML

---

## 十一、开发步骤

### 阶段一：数据库与服务层 ✅
1. ✅ 在 `schema.prisma` 中添加新模型
2. ✅ 生成并执行迁移
3. ✅ 创建 `services/collection.ts`
4. ✅ 编写单元测试

### 阶段二：API 接口 ✅
1. ✅ 前端展示 API (`/api/collections/*`)
2. ✅ 管理后台 API (`/api/admin/collections/*`)
3. ✅ API 测试（Postman/Insomnia）

### 阶段三：前端页面 ✅
1. ✅ 创建合集列表页 `/collections/page.tsx`
2. ✅ 创建合集详情页 `/collections/[slug]/page.tsx`
3. ✅ 增强文章详情页，显示合集信息
4. ✅ 在文章编辑页增加合集选择器

### 阶段四：管理后台 ✅
1. ✅ 创建 `/c/collections` 管理页
2. ✅ 创建 `/c/collections/[id]` 编辑页
3. ✅ 更新导航菜单
4. ✅ 集成文章关联管理

### 阶段五：测试与优化 ✅
1. ✅ 功能测试
2. ✅ 性能测试
3. ✅ 移动端适配
4. ✅ SEO 优化

---

## 十二、扩展功能（未来可选）

### 1. 合集标签系统
- 给合集打标签
- 按标签筛选合集

### 2. 合集推荐
- 根据用户阅读历史推荐相关合集

### 3. 订阅功能
- 用户可订阅合集，有新文章时通知

### 4. 导入导出
- 导出合集文章列表（Markdown/JSON）
- 批量导入文章到合集

### 5. 多级合集
- 支持合集嵌套（合集套合集）

---

## 附录：相关文件清单

### 数据库
- `prisma/schema.prisma` - 新增模型

### 服务层
- `src/services/collection.ts` - 新增（主要业务逻辑）

### API 路由
- `src/app/api/collections/route.ts` - 合集列表
- `src/app/api/collections/[slug]/route.ts` - 合集详情
- `src/app/api/collections/[id]/views/route.ts` - 浏览量
- `src/app/api/collections/[id]/likes/route.ts` - 点赞
- `src/app/api/admin/collections/route.ts` - 管理：创建、列表
- `src/app/api/admin/collections/[id]/route.ts` - 管理：更新、删除
- `src/app/api/admin/collections/[id]/posts/route.ts` - 文章关联管理
- `src/app/api/admin/collections/[id]/sort/route.ts` - 排序管理
- `src/app/api/posts/[id]/collections/route.ts` - 文章所属合集

### 前端页面
- `src/app/c/collections/page.tsx` - 管理后台合集列表
- `src/app/c/collections/[id]/page.tsx` - 管理后台合集编辑
- `src/app/c/collections/new/page.tsx` - 创建合集（可选）
- `src/app/c/collections/[id]/posts/page.tsx` - 合集文章管理（可选）
- `src/app/c/layout.tsx` - 更新导航菜单
- `src/app/c/post/page.tsx` - 文章编辑页增加合集选择（可选）
- `src/app/c/edit/[id]/page.tsx` - 文章编辑页增强

### 前端展示页面
- `src/app/collections/page.tsx` - 合集列表页
- `src/app/collections/[slug]/page.tsx` - 合集详情页

### 前端组件
- `src/components/CollectionCard.tsx` - 合集卡片
- `src/components/ArticleInCollectionItem.tsx` - 合集内文章项
- `src/components/CollectionSelector.tsx` - 文章编辑页的合集选择器
- `src/components/CollectionBadge.tsx` - 文章详情页的合集标签（可选）

### DTO 类型
- `src/dto/collection.dto.ts` - 新增（定义类型）

### 工具函数
- `src/lib/collection.utils.ts` - 新增（可选，用于slug生成等）

---

**文档版本**：v1.0
**创建时间**：2024-01-15
**最后更新**：2024-01-15
**适用系统**：React Blog v2.x
