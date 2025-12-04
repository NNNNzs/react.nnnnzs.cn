# TypeORM 到 Prisma 迁移指南

本文档记录了项目从 TypeORM 迁移到 Prisma 的完整过程和注意事项。

## 🎯 迁移概述

### 迁移原因

- **类型安全**: Prisma 提供更好的 TypeScript 类型推断
- **开发体验**: Prisma Studio 可视化工具、更直观的 API
- **性能优化**: 更好的查询优化和连接池管理
- **生态支持**: 更活跃的社区和更频繁的更新
- **Docker 友好**: 更好的多平台支持

### 主要变更

1. **依赖变更**:
   - 移除: `typeorm`, `reflect-metadata`, `mysql2`
   - 添加: `@prisma/client@6.2.1`, `prisma@6.2.1`

2. **配置变更**:
   - 环境变量从多个字段合并为 `DATABASE_URL`
   - Schema 定义从装饰器改为 Prisma Schema Language

3. **代码结构变更**:
   - 删除: `src/entities/`, `src/lib/data-source.ts`, `src/lib/repositories.ts`
   - 新增: `prisma/schema.prisma`, `src/lib/prisma.ts`

## 📦 安装 Prisma

```bash
# 安装 Prisma 依赖
pnpm add @prisma/client@6.2.1
pnpm add -D prisma@6.2.1

# 生成 Prisma Client
pnpm prisma generate
```

## 🔧 配置变更

### 1. 环境变量

**TypeORM (旧)**:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=password
DB_DATABASE=system
```

**Prisma (新)**:
```env
DATABASE_URL="mysql://root:password@localhost:3306/system"
```

### 2. Schema 定义

**TypeORM (旧)**: `src/entities/post.entity.ts`
```typescript
import 'reflect-metadata';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tb_post', { schema: 'system' })
export class TbPost {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id!: number;

  @Column('varchar', { name: 'title', nullable: true, length: 255 })
  title!: string | null;
  
  // ...
}
```

**Prisma (新)**: `prisma/schema.prisma`
```prisma
model TbPost {
  id          Int       @id @default(autoincrement())
  title       String?   @db.VarChar(255)
  
  @@map("tb_post")
}
```

### 3. 数据库连接

**TypeORM (旧)**: `src/lib/data-source.ts`
```typescript
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  // ...
});

export async function getDataSource(): Promise<DataSource> {
  // ...
}
```

**Prisma (新)**: `src/lib/prisma.ts`
```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function getPrisma(): Promise<PrismaClient> {
  return prisma;
}
```

## 🔄 代码迁移对照表

### 查询操作

| 操作 | TypeORM | Prisma |
|------|---------|--------|
| 查询所有 | `repository.find()` | `prisma.model.findMany()` |
| 条件查询 | `repository.find({ where: {...} })` | `prisma.model.findMany({ where: {...} })` |
| 查询单条 | `repository.findOne({ where: {...} })` | `prisma.model.findUnique({ where: {...} })` |
| 第一条 | `repository.findOne(...)` | `prisma.model.findFirst(...)` |
| 统计 | `repository.count({ where: {...} })` | `prisma.model.count({ where: {...} })` |
| 分页 | `repository.findAndCount({ take, skip })` | 分别调用 `findMany` 和 `count` |

### 创建操作

**TypeORM**:
```typescript
const entity = repository.create(data);
await repository.save(entity);
```

**Prisma**:
```typescript
await prisma.model.create({ data });
```

### 更新操作

**TypeORM**:
```typescript
await repository.update(id, data);
```

**Prisma**:
```typescript
await prisma.model.update({
  where: { id },
  data,
});
```

### 删除操作

**TypeORM**:
```typescript
await repository.delete(id);
```

**Prisma**:
```typescript
await prisma.model.delete({
  where: { id },
});
```

### 模糊查询

**TypeORM**:
```typescript
import { Like } from 'typeorm';

await repository.find({
  where: { title: Like('%keyword%') },
});
```

**Prisma**:
```typescript
await prisma.model.findMany({
  where: { 
    title: { contains: 'keyword' } 
  },
});
```

### 排序

**TypeORM**:
```typescript
await repository.find({
  order: { date: 'DESC' },
});
```

**Prisma**:
```typescript
await prisma.model.findMany({
  orderBy: { date: 'desc' },
});
```

### 字段选择

**TypeORM**:
```typescript
await repository.find({
  select: ['id', 'title', 'date'],
});
```

**Prisma**:
```typescript
await prisma.model.findMany({
  select: {
    id: true,
    title: true,
    date: true,
  },
});
```

## 🐳 Docker 配置变更

### Dockerfile 变更

添加 Prisma Client 生成和文件复制：

```dockerfile
# 构建阶段
RUN pnpm prisma generate
RUN pnpm build

# 运行阶段
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
```

### Schema 配置

确保支持多平台：

```prisma
generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

## 🔄 迁移步骤

### 1. 准备工作

```bash
# 备份数据库
mysqldump -u root -p system > backup.sql

# 创建分支
git checkout -b feature/migrate-to-prisma
```

### 2. 安装依赖

```bash
# 安装 Prisma
pnpm add @prisma/client@6.2.1
pnpm add -D prisma@6.2.1

# 创建 prisma 目录
mkdir -p prisma
```

### 3. 创建 Schema

创建 `prisma/schema.prisma` 并定义所有模型。

### 4. 生成 Client

```bash
pnpm prisma generate
```

### 5. 更新代码

1. 创建 `src/lib/prisma.ts`
2. 更新所有服务层文件 (`src/services/`)
3. 删除旧的实体和 Repository 文件

### 6. 移除 TypeORM

```bash
# 删除依赖
pnpm remove typeorm reflect-metadata mysql2

# 删除文件
rm -rf src/entities/
rm src/lib/data-source.ts
rm src/lib/repositories.ts
rm src/lib/transformers.ts
```

### 7. 更新配置

1. 更新 `tsconfig.json`（移除装饰器配置）
2. 更新 `Dockerfile` 和 `Dockerfile.prod`
3. 更新 `package.json` 脚本
4. 更新文档

### 8. 测试

```bash
# 本地开发测试
pnpm dev

# 构建测试
pnpm build

# Docker 测试
pnpm build:docker
```

### 9. 提交

```bash
git add .
git commit -m "feat: 从 TypeORM 迁移到 Prisma"
```

## ⚠️ 注意事项

### 1. 类型差异

- Prisma 生成的类型更严格，可能需要调整代码
- `Date` 字段在 Prisma 中总是 `Date` 对象，不像 TypeORM 可能是字符串

### 2. 查询语法

- Prisma 使用对象风格的查询，不支持 SQL 片段
- 复杂查询可能需要使用 `$queryRaw` 或 `$executeRaw`

### 3. 事务处理

**TypeORM**:
```typescript
await dataSource.transaction(async (manager) => {
  // ...
});
```

**Prisma**:
```typescript
await prisma.$transaction(async (tx) => {
  // ...
});
```

### 4. 软删除

Prisma 不内置软删除，需要手动实现：

```typescript
// 软删除
await prisma.model.update({
  where: { id },
  data: { is_delete: 1 },
});

// 查询时过滤
await prisma.model.findMany({
  where: { is_delete: 0 },
});
```

### 5. 连接池

Prisma 自动管理连接池，不需要手动配置。如需自定义：

```env
DATABASE_URL="mysql://user:password@host:3306/database?connection_limit=10&pool_timeout=20"
```

## 🚀 性能优化

### 1. 查询优化

```typescript
// 只查询需要的字段
const posts = await prisma.tbPost.findMany({
  select: {
    id: true,
    title: true,
  },
});

// 使用批量操作
await prisma.tbPost.createMany({
  data: posts,
});
```

### 2. 索引优化

在 Schema 中定义索引：

```prisma
model TbPost {
  // ...
  
  @@index([date])
  @@index([hide, is_delete])
}
```

### 3. 连接优化

使用连接池参数：

```env
DATABASE_URL="mysql://user:password@host:3306/db?connection_limit=10&pool_timeout=20"
```

## 🛠️ 常用工具

### 1. Prisma Studio

可视化数据库管理工具：

```bash
pnpm prisma studio
```

### 2. 数据库同步

```bash
# 从数据库拉取 Schema
pnpm prisma db pull

# 推送 Schema 到数据库
pnpm prisma db push
```

### 3. 迁移管理

```bash
# 创建迁移
pnpm prisma migrate dev --name migration_name

# 应用迁移（生产环境）
pnpm prisma migrate deploy
```

## 📊 对比总结

| 特性 | TypeORM | Prisma |
|------|---------|--------|
| 类型安全 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 学习曲线 | 中等 | 简单 |
| 性能 | 好 | 更好 |
| 可视化工具 | 无 | Prisma Studio |
| 社区活跃度 | 中等 | 高 |
| 文档质量 | 中等 | 优秀 |
| 迁移系统 | 有 | 有 |
| 多数据库支持 | 优秀 | 优秀 |
| 原生 SQL | 支持 | 支持 |

## 📚 参考资料

- [Prisma 官方文档](https://www.prisma.io/docs)
- [从 TypeORM 迁移到 Prisma](https://www.prisma.io/docs/guides/migrate-to-prisma/migrate-from-typeorm)
- [Prisma Schema 参考](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)

## ✅ 迁移检查清单

- [x] 安装 Prisma 依赖
- [x] 创建 Prisma Schema
- [x] 生成 Prisma Client
- [x] 创建数据库连接文件 (`src/lib/prisma.ts`)
- [x] 迁移所有服务层代码
- [x] 删除 TypeORM 实体和 Repository
- [x] 移除 TypeORM 依赖
- [x] 更新 tsconfig.json
- [x] 更新 Docker 配置
- [x] 更新 package.json 脚本
- [x] 更新 .cursorrules
- [x] 更新数据库文档
- [x] 删除 TRANSFORMERS.md
- [x] 测试所有功能
- [x] 提交代码

## 🎉 迁移完成

恭喜！项目已成功从 TypeORM 迁移到 Prisma。享受更好的开发体验吧！
