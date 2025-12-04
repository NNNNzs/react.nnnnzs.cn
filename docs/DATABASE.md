# 数据库使用指南

本项目使用 Prisma + MySQL + Redis，完全参考 `api.nnnnzs.cn` NestJS 项目的数据库设计。

## 📋 前置要求

### 1. MySQL 数据库

本项目需要使用**已有的** MySQL 数据库（支持 MySQL 5.7+），确保数据库中已存在以下表：

- `tb_post` - 文章表
- `tb_user` - 用户表
- `tb_config` - 配置表

> **注意**: 项目不会自动创建表结构，请参考参考项目 `api.nnnnzs.cn` 的数据库结构创建表，或使用下方的 SQL 语句创建。

### 2. Redis 服务

确保 Redis 服务已启动并可访问，用于存储用户 Token。

## ⚙️ 环境变量配置

复制 `.env.example` 到 `.env`：

```bash
cp .env.example .env
```

配置数据库和 Redis 连接信息：

```env
# MySQL 数据库配置（Prisma 格式）
DATABASE_URL="mysql://root:your_password@localhost:3306/system"

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 应用配置
NODE_ENV=development
JWT_SECRET=your-secret-key-here
```

> **注意**: `DATABASE_URL` 格式为 `mysql://用户名:密码@主机:端口/数据库名`

## 🗃️ 数据库表结构

### 1. 文章表 (tb_post)

```sql
CREATE TABLE `tb_post` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `path` varchar(255) DEFAULT NULL COMMENT '路径',
  `title` varchar(255) DEFAULT NULL COMMENT '标题',
  `category` varchar(255) DEFAULT NULL COMMENT '分类',
  `tags` varchar(255) DEFAULT NULL COMMENT '标签（逗号分隔）',
  `date` datetime DEFAULT NULL COMMENT '创建时间',
  `updated` datetime DEFAULT NULL COMMENT '更新时间',
  `cover` varchar(255) DEFAULT NULL COMMENT '封面图',
  `layout` varchar(255) DEFAULT NULL COMMENT '布局',
  `content` text COMMENT '内容',
  `description` varchar(500) DEFAULT NULL COMMENT '描述',
  `visitors` int(11) DEFAULT 0 COMMENT '访问量',
  `likes` int(11) DEFAULT 0 COMMENT '喜欢数',
  `hide` varchar(255) DEFAULT '0' COMMENT '是否隐藏 0-显示 1-隐藏',
  `is_delete` int(11) NOT NULL DEFAULT 0 COMMENT '是否删除 0-否 1-是',
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date`),
  KEY `idx_hide_delete` (`hide`, `is_delete`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章表';
```

### 2. 用户表 (tb_user)

```sql
CREATE TABLE `tb_user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `role` varchar(255) DEFAULT NULL COMMENT '角色',
  `account` varchar(16) NOT NULL COMMENT '账号',
  `avatar` varchar(255) DEFAULT NULL COMMENT '头像',
  `password` varchar(255) NOT NULL COMMENT '密码',
  `nickname` varchar(16) NOT NULL COMMENT '昵称',
  `mail` varchar(30) DEFAULT NULL COMMENT '邮箱',
  `phone` varchar(11) DEFAULT NULL COMMENT '手机号',
  `registered_ip` varchar(16) DEFAULT NULL COMMENT '注册IP',
  `registered_time` datetime DEFAULT NULL COMMENT '注册时间',
  `dd_id` varchar(30) DEFAULT NULL COMMENT '钉钉ID',
  `github_id` varchar(255) DEFAULT NULL COMMENT 'GitHub ID',
  `work_wechat_id` varchar(255) DEFAULT NULL COMMENT '企业微信ID',
  `status` int(11) NOT NULL DEFAULT 1 COMMENT '状态 1-正常 0-禁用',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_account` (`account`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
```

### 3. 配置表 (tb_config)

```sql
CREATE TABLE `tb_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(20) DEFAULT NULL COMMENT '标题',
  `key` varchar(20) DEFAULT NULL COMMENT '键名',
  `value` text COMMENT '值',
  `status` int(11) DEFAULT NULL COMMENT '状态',
  `created_at` datetime DEFAULT NULL COMMENT '创建时间',
  `updated_at` datetime DEFAULT NULL COMMENT '更新时间',
  `last_read_at` datetime DEFAULT NULL COMMENT '最后读取时间',
  `remark` text COMMENT '备注',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配置表';
```

## 🔧 配置说明

### Prisma Schema 配置 (prisma/schema.prisma)

```prisma
generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model TbPost {
  id          Int       @id @default(autoincrement())
  path        String?   @db.VarChar(255)
  title       String?   @db.VarChar(255)
  category    String?   @db.VarChar(255)
  tags        String?   @db.VarChar(255)
  date        DateTime? @db.DateTime(0)
  updated     DateTime? @db.DateTime(0)
  cover       String?   @db.VarChar(255)
  layout      String?   @db.VarChar(255)
  content     String?   @db.Text
  description String?   @db.VarChar(500)
  visitors    Int?      @default(0)
  likes       Int?      @default(0)
  hide        String?   @default("0") @db.VarChar(255)
  is_delete   Int       @default(0)

  @@map("tb_post")
}
```

### Prisma Client 配置 (src/lib/prisma.ts)

```typescript
import { PrismaClient } from '@prisma/client';

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export async function getPrisma(): Promise<PrismaClient> {
  return prisma;
}
```

### Redis 客户端配置 (src/lib/redis.ts)

```typescript
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB) || 0,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});
```

#### Token 存储格式

- **Key**: `user:{token}`
- **Value**: JSON 格式的用户信息（不包含密码）
- **过期时间**: 7 天 (604800 秒)

## 📝 数据库操作示例

### 1. 获取 Prisma Client

```typescript
import { getPrisma } from '@/lib/prisma';

const prisma = await getPrisma();
```

### 2. 查询操作

```typescript
// 查询所有
const posts = await prisma.tbPost.findMany();

// 条件查询
const posts = await prisma.tbPost.findMany({
  where: { 
    hide: '0', 
    is_delete: 0 
  },
  orderBy: { 
    date: 'desc' 
  },
});

// 分页查询
const [posts, total] = await Promise.all([
  prisma.tbPost.findMany({
    where: { hide: '0' },
    take: 10,
    skip: 0,
  }),
  prisma.tbPost.count({
    where: { hide: '0' },
  }),
]);

// 模糊查询
const posts = await prisma.tbPost.findMany({
  where: { 
    title: { 
      contains: '关键词' 
    } 
  },
});

// 查询单条记录
const post = await prisma.tbPost.findUnique({
  where: { id: 1 },
});

// 查询第一条匹配的记录
const post = await prisma.tbPost.findFirst({
  where: { title: '文章标题' },
});
```

### 3. 创建操作

```typescript
const newPost = await prisma.tbPost.create({
  data: {
    title: '新文章',
    content: '内容',
    tags: 'JavaScript,React',
    hide: '0',
    is_delete: 0,
    date: new Date(),
    updated: new Date(),
  },
});
```

### 4. 更新操作

```typescript
const updatedPost = await prisma.tbPost.update({
  where: { id: 1 },
  data: {
    title: '更新后的标题',
    updated: new Date(),
  },
});
```

### 5. 删除操作（软删除）

```typescript
await prisma.tbPost.update({
  where: { id: 1 },
  data: {
    is_delete: 1,
  },
});

// 硬删除
await prisma.tbPost.delete({
  where: { id: 1 },
});
```

### 6. 聚合查询

```typescript
// 统计数量
const count = await prisma.tbPost.count({
  where: { hide: '0' },
});

// 聚合操作
const result = await prisma.tbPost.aggregate({
  _count: true,
  _avg: { visitors: true },
  _sum: { likes: true },
  where: { is_delete: 0 },
});
```

## 🔐 数据库安全

### 1. 密码加密

用户密码使用 bcryptjs 加密：

```typescript
import bcrypt from 'bcryptjs';

// 加密
const hashedPassword = await bcrypt.hash(password, 10);

// 验证
const isValid = await bcrypt.compare(password, hashedPassword);
```

### 2. SQL 注入防护

Prisma 自动防止 SQL 注入，所有查询使用参数化：

```typescript
// 安全 ✅
const post = await prisma.tbPost.findUnique({
  where: { id: userId },
});

// Prisma 会自动参数化
const posts = await prisma.tbPost.findMany({
  where: { title: { contains: userInput } },
});
```

### 3. 敏感字段处理

在查询时排除敏感字段：

```typescript
// 排除密码字段
const user = await prisma.tbUser.findUnique({
  where: { id: 1 },
  select: {
    id: true,
    account: true,
    nickname: true,
    // password 不包含在内
  },
});

// 或者在返回时删除
const user = await prisma.tbUser.findUnique({
  where: { id: 1 },
});
const { password, ...userWithoutPassword } = user;
```

## 🚀 生产环境部署

### 1. 环境变量配置

确保生产环境配置正确：

```env
NODE_ENV=production
DATABASE_URL="mysql://user:password@production-host:3306/system"

REDIS_HOST=your-production-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

JWT_SECRET=your-production-secret-key
```

### 2. 生成 Prisma Client

```bash
# 生成 Prisma Client
pnpm prisma generate

# 将现有数据库结构同步到 Prisma（开发环境）
pnpm prisma db pull

# 将 Schema 变更推送到数据库（开发环境）
pnpm prisma db push

# 创建迁移（生产环境推荐）
pnpm prisma migrate dev --name init

# 应用迁移（生产环境）
pnpm prisma migrate deploy
```

### 3. 数据备份

```bash
# 备份数据库
mysqldump -u root -p system > backup.sql

# 恢复数据库
mysql -u root -p system < backup.sql
```

## 📊 性能优化

### 1. 使用索引

Prisma Schema 中定义索引：

```prisma
model TbPost {
  id Int @id @default(autoincrement())
  // ...
  
  @@index([date])
  @@index([hide, is_delete])
}
```

### 2. 查询优化

```typescript
// 只查询需要的字段
const posts = await prisma.tbPost.findMany({
  select: {
    id: true,
    title: true,
    date: true,
  },
});

// 批量操作
await prisma.tbPost.createMany({
  data: [
    { title: 'Post 1', content: 'Content 1' },
    { title: 'Post 2', content: 'Content 2' },
  ],
});
```

### 3. 连接池配置

Prisma 自动管理连接池，可以通过环境变量配置：

```env
DATABASE_URL="mysql://user:password@host:3306/database?connection_limit=10"
```

## 🛠️ Prisma 常用命令

```bash
# 生成 Prisma Client
pnpm prisma generate

# 打开 Prisma Studio（数据库可视化工具）
pnpm prisma studio

# 从数据库拉取 Schema
pnpm prisma db pull

# 推送 Schema 到数据库（开发环境）
pnpm prisma db push

# 创建迁移
pnpm prisma migrate dev --name migration_name

# 应用迁移（生产环境）
pnpm prisma migrate deploy

# 重置数据库
pnpm prisma migrate reset

# 格式化 Schema 文件
pnpm prisma format

# 验证 Schema 文件
pnpm prisma validate
```

## 🔍 常见问题

### Q: 如何修改数据库连接配置？

A: 修改 `.env` 文件中的 `DATABASE_URL` 和 Redis 配置。

### Q: 数据库表不存在？

A: 本项目需要使用现成的数据库，请参考上方的 SQL 语句创建数据库表，或使用 `prisma db push` 同步 Schema 到数据库。

### Q: Prisma Client 报错？

A: 检查：
1. 是否已运行 `pnpm prisma generate` 生成 Client
2. MySQL 服务是否启动
3. DATABASE_URL 是否配置正确
4. 数据库和表是否已创建
5. 用户权限是否正确

### Q: 修改 Schema 后如何更新？

A: 
```bash
# 1. 修改 prisma/schema.prisma
# 2. 重新生成 Client
pnpm prisma generate
# 3. 推送到数据库（开发环境）
pnpm prisma db push
# 或创建迁移（生产环境）
pnpm prisma migrate dev
```

### Q: Docker 环境中 Prisma 报错？

A: 确保 Dockerfile 中包含：
```dockerfile
# 生成 Prisma Client
RUN pnpm prisma generate

# 复制 Prisma 文件
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
```

### Q: Redis 连接失败？

A: 检查：
1. Redis 服务是否启动
2. Redis 配置是否正确（主机、端口、密码）
3. 防火墙是否允许连接

### Q: 如何查看 SQL 执行日志？

A: 在 Prisma Client 初始化时配置日志：

```typescript
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

### Q: Token 存储在哪里？

A: Token 存储在 Redis 中，Key 格式为 `user:{token}`，有效期 7 天。可以使用 Redis 客户端查看：

```bash
redis-cli
> KEYS user:*
> GET user:{your-token}
```

## 📚 参考资料

- [Prisma 官方文档](https://www.prisma.io/docs)
- [Prisma 中文文档](https://prisma.yoga)
- [MySQL 官方文档](https://dev.mysql.com/doc/)
- [api.nnnnzs.cn 项目](https://github.com/NNNNzs/api.nnnnzs.cn)
