# 数据库使用指南

本项目使用 TypeORM + MySQL + Redis，完全参考 `api.nnnnzs.cn` NestJS 项目的数据库设计。

## 📋 前置要求

### 1. MySQL 数据库

本项目需要使用**已有的** MySQL 数据库，确保数据库中已存在以下表：

- `tb_post` - 文章表
- `tb_user` - 用户表

> **注意**: 项目不会自动创建表结构，请参考参考项目 `api.nnnnzs.cn` 的数据库结构创建表。

### 2. Redis 服务

确保 Redis 服务已启动并可访问，用于存储用户 Token。

## ⚙️ 环境变量配置

复制 `.env.example` 到 `.env`：

```bash
cp .env.example .env
```

配置数据库和 Redis 连接信息：

```env
# MySQL 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=system

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 应用配置
NODE_ENV=development
JWT_SECRET=your-secret-key-here
```

## 🗃️ 数据库表结构

### 1. 文章表 (tb_post)

```sql
CREATE TABLE `tb_post` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `path` varchar(255) DEFAULT NULL COMMENT '路径',
  `title` varchar(255) DEFAULT NULL COMMENT '标题',
  `oldTitle` varchar(255) DEFAULT NULL COMMENT '旧标题',
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
  `hide` varchar(1) DEFAULT '0' COMMENT '是否隐藏 0-显示 1-隐藏',
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
  `role` varchar(20) DEFAULT NULL COMMENT '角色',
  `account` varchar(16) NOT NULL COMMENT '账号',
  `avatar` varchar(255) DEFAULT NULL COMMENT '头像',
  `password` varchar(255) NOT NULL COMMENT '密码',
  `nickname` varchar(16) NOT NULL COMMENT '昵称',
  `mail` varchar(30) DEFAULT NULL COMMENT '邮箱',
  `phone` varchar(11) DEFAULT NULL COMMENT '手机号',
  `registered_ip` varchar(16) DEFAULT NULL COMMENT '注册IP',
  `registered_time` datetime DEFAULT NULL COMMENT '注册时间',
  `dd_id` varchar(30) DEFAULT NULL COMMENT '钉钉ID',
  `github_id` varchar(50) DEFAULT NULL COMMENT 'GitHub ID',
  `work_wechat_id` varchar(255) DEFAULT NULL COMMENT '企业微信ID',
  `status` int(11) NOT NULL DEFAULT 1 COMMENT '状态 1-正常 0-禁用',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_account` (`account`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
```

## 🔧 配置说明

### TypeORM 数据源配置 (src/lib/data-source.ts)

```typescript
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'system',
  synchronize: false, // 使用现成的数据库，不自动同步
  logging: process.env.NODE_ENV === 'development',
  entities: [TbPost, TbUser],
  charset: 'utf8mb4',
  extra: {
    connectionLimit: 10, // 连接池配置
  },
});
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

### 实体定义

#### 文章实体 (src/entities/post.entity.ts)

```typescript
@Entity('tb_post', { schema: 'system' })
export class TbPost {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'title', nullable: true, length: 255 })
  title: string | null;

  // ... 其他字段
}
```

#### 用户实体 (src/entities/user.entity.ts)

```typescript
@Entity('tb_user', { schema: 'system' })
export class TbUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 16 })
  account: string;

  // ... 其他字段
}
```

## 📝 数据库操作示例

### 1. 获取 Repository

```typescript
import { getPostRepository } from '@/lib/repositories';

const postRepository = await getPostRepository();
```

### 2. 查询操作

```typescript
// 查询所有
const posts = await postRepository.find();

// 条件查询
const posts = await postRepository.find({
  where: { hide: '0', is_delete: 0 },
  order: { date: 'DESC' },
});

// 分页查询
const [posts, total] = await postRepository.findAndCount({
  where: { hide: '0' },
  take: 10,
  skip: 0,
});

// 模糊查询
import { Like } from 'typeorm';

const posts = await postRepository.find({
  where: { title: Like('%关键词%') },
});
```

### 3. 创建操作

```typescript
const newPost = await postRepository.save({
  title: '新文章',
  content: '内容',
  tags: 'JavaScript,React',
  hide: '0',
  is_delete: 0,
});
```

### 4. 更新操作

```typescript
await postRepository.update(1, {
  title: '更新后的标题',
  updated: new Date(),
});
```

### 5. 删除操作（软删除）

```typescript
await postRepository.update(1, {
  is_delete: 1,
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

TypeORM 自动防止 SQL 注入，所有查询使用参数化：

```typescript
// 安全 ✅
const post = await postRepository.findOne({
  where: { id: userId },
});

// 不安全 ❌
const post = await postRepository.query(
  `SELECT * FROM tb_post WHERE id = ${userId}`
);
```

### 3. 敏感字段处理

密码字段默认不会被查询出来：

```typescript
@Column({ length: 255, select: false })
password: string;
```

需要密码时显式指定：

```typescript
const user = await userRepository.findOne({
  where: { account },
  select: ['id', 'account', 'password', 'nickname'],
});
```

## 🚀 生产环境部署

### 1. 环境变量配置

确保生产环境配置正确：

```env
NODE_ENV=production
DB_HOST=your-production-db-host
DB_PORT=3306
DB_USERNAME=your-production-db-user
DB_PASSWORD=your-production-db-password
DB_DATABASE=system

REDIS_HOST=your-production-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

JWT_SECRET=your-production-secret-key
```

### 2. 数据库连接

生产环境 `synchronize` 固定为 `false`，不会自动修改表结构，确保数据安全。

### 3. 数据备份

```bash
# 备份数据库
mysqldump -u root -p system > backup.sql

# 恢复数据库
mysql -u root -p system < backup.sql
```

## 📊 性能优化

### 1. 添加索引

```typescript
@Entity('tb_post')
@Index(['date'])
@Index(['hide', 'is_delete'])
export class TbPost {
  // ...
}
```

### 2. 查询优化

```typescript
// 只查询需要的字段
const posts = await postRepository.find({
  select: ['id', 'title', 'date'],
});

// 关联查询优化
const posts = await postRepository.find({
  relations: ['author'],
  where: { hide: '0' },
});
```

### 3. 连接池配置

```typescript
export const AppDataSource = new DataSource({
  // ...
  extra: {
    connectionLimit: 10,
  },
});
```

## 🔍 常见问题

### Q: 如何修改数据库连接配置？

A: 修改 `.env` 文件中的数据库和 Redis 配置。

### Q: 数据库表不存在？

A: 本项目需要使用现成的数据库，请参考 `api.nnnnzs.cn` 项目创建数据库表。

### Q: TypeORM 报错连接失败？

A: 检查：
1. MySQL 服务是否启动
2. 数据库是否存在
3. 表结构是否已创建
4. 用户名密码是否正确
5. 端口是否正确

### Q: Redis 连接失败？

A: 检查：
1. Redis 服务是否启动
2. Redis 配置是否正确（主机、端口、密码）
3. 防火墙是否允许连接

### Q: 如何查看 SQL 执行日志？

A: 开发环境下会自动启用日志，或者修改 `src/lib/data-source.ts`：

```typescript
export const AppDataSource = new DataSource({
  // ...
  logging: true,
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

- [TypeORM 官方文档](https://typeorm.io)
- [MySQL 官方文档](https://dev.mysql.com/doc/)
- [api.nnnnzs.cn 项目](https://github.com/NNNNzs/api.nnnnzs.cn)

