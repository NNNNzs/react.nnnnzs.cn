# 数据库开发规范

## 数据库技术栈

### 核心技术
- **ORM**: Prisma 0.3.27
- **数据库**: MySQL 5.7+
- **客户端**: Prisma Client
- **迁移工具**: 自定义 SQL 脚本（非 Prisma Migrate）

### 数据库连接配置
```bash
# 环境变量
DATABASE_URL="mysql://user:password@host:port/database"
```

## 数据模型定义

### Prisma Schema 位置
- **文件**: `prisma/schema.prisma`
- **备份**: `src/generated/prisma-client/schema.prisma`

### 实体命名规范
- **表名**: `tb_` 前缀 + 小写 + 下划线（如：`tb_post`, `tb_user`）
- **字段名**: 小写 + 下划线（如：`created_at`, `user_id`）
- **主键**: `id` (BigInt, Auto Increment)
- **软删除**: `is_delete` (Int, 0=正常, 1=删除)
- **时间戳**: 
  - `created_at` (DateTime, @default(now()))
  - `updated_at` (DateTime, @updatedAt)

### 基础实体模板
```prisma
// prisma/schema.prisma

model TbBase {
  id         BigInt    @id @default(autoincrement())
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  is_delete  Int       @default(0)

  @@index([is_delete])
  @@map("tb_base")
}

// 示例：文章表
model TbPost extends TbBase {
  title     String?
  content   String?
  category  String?
  tags      String?   // 存储为逗号分隔的字符串
  date      DateTime?
  hide      String    @default("0")
  visitors  Int       @default(0)
  likes     Int       @default(0)

  @@map("tb_post")
}

// 示例：用户表
model TbUser extends TbBase {
  username  String   @unique
  password  String
  nickname  String?
  avatar    String?
  email     String?
  role      String   @default("user")  // user, admin
  github_id String?  @unique
  wechat_id String?  @unique

  @@map("tb_user")
}

// 示例：评论表
model TbComment extends TbBase {
  post_id   BigInt
  user_id   BigInt
  content   String
  parent_id BigInt?  // 评论回复

  @@map("tb_comment")
}
```

## 数据库迁移规范

### 重要原则
**⚠️ 本项目不使用 Prisma Migrate，必须手写 SQL 迁移脚本**

### 迁移文件管理

#### 迁移文件位置
```
docs/migrations/
├── 20251218_001_create_tables.sql          # 初始建表
├── 20251218_002_add_user_fields.sql        # 添加字段
├── 20251218_003_create_indexes.sql         # 创建索引
└── README.md                                # 迁移说明
```

#### 迁移文件命名规范
```
YYYYMMDD_序号_描述.sql
```

示例：
- `20251218_001_initial_schema.sql`
- `20251218_002_add_post_tags.sql`
- `20251218_003_create_user_indexes.sql`

### 迁移开发流程

#### 1. 修改 Schema
```bash
# 1. 修改 prisma/schema.prisma
# 2. 重新生成 Prisma Client
pnpm prisma generate
```

#### 2. 生成迁移 SQL
```bash
# 1. 比较 Schema 和数据库差异
# 2. 手动编写 SQL 迁移脚本
# 3. 保存到 docs/migrations/
# 4. 在本地测试
# 5. 更新数据库记录
```

#### 3. 迁移脚本模板
```sql
-- docs/migrations/20251218_001_add_user_fields.sql

-- 说明：添加用户表的手机号字段
-- 作者：[你的名字]
-- 日期：2025-12-18
-- 影响表：tb_user

-- 开始事务
START TRANSACTION;

-- 添加字段（如果不存在）
-- MySQL 5.7+ 检查字段是否存在
SET @db_name = DATABASE();
SET @table_name = 'tb_user';
SET @column_name = 'phone';

-- 检查字段是否存在
SELECT COUNT(*) INTO @column_exists
FROM information_schema.columns
WHERE table_schema = @db_name
  AND table_name = @table_name
  AND column_name = @column_name;

-- 如果字段不存在，则添加
IF @column_exists = 0 THEN
    ALTER TABLE tb_user 
    ADD COLUMN phone VARCHAR(20) NULL AFTER email,
    ADD INDEX idx_phone (phone);
    
    SELECT '字段添加成功' AS result;
ELSE
    SELECT '字段已存在，跳过' AS result;
END IF;

-- 提交事务
COMMIT;
```

#### 4. 安全的字段添加
```sql
-- 安全地添加字段（支持回滚）

-- 1. 检查字段是否存在
SELECT COUNT(*) as count
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'tb_user'
  AND column_name = 'new_field';

-- 2. 添加字段
ALTER TABLE tb_user 
ADD COLUMN new_field VARCHAR(255) NULL DEFAULT NULL;

-- 3. 添加索引（可选）
ALTER TABLE tb_user 
ADD INDEX idx_new_field (new_field);

-- 4. 更新现有数据（可选）
UPDATE tb_user 
SET new_field = 'default_value' 
WHERE new_field IS NULL;

-- 5. 修改为非空（可选，需要先填充数据）
ALTER TABLE tb_user 
MODIFY COLUMN new_field VARCHAR(255) NOT NULL;
```

#### 5. 索引管理
```sql
-- 创建索引
ALTER TABLE tb_post 
ADD INDEX idx_category (category),
ADD INDEX idx_date (date),
ADD INDEX idx_hide (hide);

-- 创建唯一索引
ALTER TABLE tb_user 
ADD UNIQUE INDEX uk_username (username);

-- 创建复合索引
ALTER TABLE tb_comment 
ADD INDEX idx_post_user (post_id, user_id);

-- 删除索引
ALTER TABLE tb_post 
DROP INDEX idx_category;
```

#### 6. 表结构变更
```sql
-- 修改字段类型
ALTER TABLE tb_user 
MODIFY COLUMN email VARCHAR(255) NULL;

-- 重命名字段（不推荐，影响代码）
ALTER TABLE tb_user 
CHANGE COLUMN old_name new_name VARCHAR(100);

-- 删除字段（谨慎操作）
ALTER TABLE tb_user 
DROP COLUMN old_field;
```

### 迁移执行流程

#### 开发环境
```bash
# 1. 查看待执行的迁移
ls -la docs/migrations/

# 2. 执行迁移（手动）
mysql -u root -p database_name < docs/migrations/20251218_001_add_fields.sql

# 3. 验证迁移
pnpm prisma db pull  # 查看当前数据库状态
```

#### 生产环境
```bash
# 1. 备份数据库
mysqldump -u root -p production_db > backup_20251218.sql

# 2. 执行迁移
mysql -u root -p production_db < docs/migrations/20251218_001_add_fields.sql

# 3. 验证
# - 检查应用日志
# - 测试相关功能
# - 回滚方案准备
```

### 迁移记录表

#### 创建迁移记录表
```sql
CREATE TABLE IF NOT EXISTS tb_migration_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    execution_time INT COMMENT '执行时间（毫秒）',
    status ENUM('success', 'failed') NOT NULL,
    error_message TEXT,
    checksum VARCHAR(64) COMMENT '文件校验和',
    INDEX idx_name (migration_name),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='迁移记录表';
```

#### 记录迁移执行
```sql
-- 在迁移脚本中添加记录
INSERT INTO tb_migration_history 
(migration_name, execution_time, status, checksum)
VALUES 
('20251218_001_add_fields.sql', 150, 'success', MD5('file_content'));
```

## 数据库操作规范

### 查询操作

#### 基础查询
```typescript
// src/services/user.ts
import { getPrisma } from '@/lib/prisma'

/**
 * 获取用户信息
 */
export async function getUserById(id: bigint) {
  const prisma = await getPrisma()
  
  return await prisma.tbUser.findUnique({
    where: { id, is_delete: 0 },
    select: {
      id: true,
      username: true,
      nickname: true,
      avatar: true,
      email: true,
      role: true,
      created_at: true,
      // 不返回 password
    },
  })
}
```

#### 分页查询
```typescript
/**
 * 分页获取文章列表
 */
export async function getPostList(params: {
  pageNum?: number
  pageSize?: number
  hide?: string
  category?: string
}) {
  const {
    pageNum = 1,
    pageSize = 10,
    hide = '0',
    category,
  } = params

  const prisma = await getPrisma()
  
  const where: any = {
    is_delete: 0,
    hide,
  }

  if (category) {
    where.category = category
  }

  const [record, total] = await Promise.all([
    prisma.tbPost.findMany({
      where,
      orderBy: { date: 'desc' },
      take: pageSize,
      skip: (pageNum - 1) * pageSize,
      select: {
        id: true,
        title: true,
        category: true,
        tags: true,
        date: true,
        visitors: true,
        likes: true,
        hide: true,
        // 不返回 content
      },
    }),
    prisma.tbPost.count({ where }),
  ])

  return { record, total, pageNum, pageSize }
}
```

### 插入操作

#### 单条插入
```typescript
/**
 * 创建用户
 */
export async function createUser(data: {
  username: string
  password: string
  nickname?: string
}) {
  const prisma = await getPrisma()
  
  // 检查用户名是否存在
  const existing = await prisma.tbUser.findUnique({
    where: { username: data.username },
  })
  
  if (existing) {
    throw new Error('用户名已存在')
  }

  return await prisma.tbUser.create({
    data: {
      username: data.username,
      password: data.password, // 已加密
      nickname: data.nickname || data.username,
      role: 'user',
    },
  })
}
```

#### 批量插入
```typescript
/**
 * 批量创建标签
 */
export async function batchCreateTags(tags: string[]) {
  const prisma = await getPrisma()
  
  const data = tags.map(tag => ({
    name: tag,
    created_at: new Date(),
  }))

  // 使用事务保证原子性
  return await prisma.$transaction([
    ...data.map(item => 
      prisma.tbTag.create({ data: item })
    )
  ])
}
```

### 更新操作

#### 基础更新
```typescript
/**
 * 更新文章
 */
export async function updatePost(id: bigint, data: Partial<TbPost>) {
  const prisma = await getPrisma()
  
  // 检查是否存在
  const existing = await prisma.tbPost.findUnique({
    where: { id, is_delete: 0 },
  })
  
  if (!existing) {
    throw new Error('文章不存在')
  }

  return await prisma.tbPost.update({
    where: { id },
    data: {
      ...data,
      updated_at: new Date(),
    },
  })
}
```

#### 软删除
```typescript
/**
 * 软删除文章
 */
export async function deletePost(id: bigint) {
  const prisma = await getPrisma()
  
  return await prisma.tbPost.update({
    where: { id },
    data: {
      is_delete: 1,
      updated_at: new Date(),
    },
  })
}
```

### 事务操作

#### 使用事务
```typescript
/**
 * 创建文章并更新统计
 */
export async function createPostWithStats(data: {
  title: string
  content: string
  userId: bigint
}) {
  const prisma = await getPrisma()
  
  return await prisma.$transaction(async (tx) => {
    // 1. 创建文章
    const post = await tx.tbPost.create({
      data: {
        title: data.title,
        content: data.content,
        user_id: data.userId,
      },
    })

    // 2. 更新用户统计
    await tx.tbUser.update({
      where: { id: data.userId },
      data: {
        post_count: {
          increment: 1,
        },
      },
    })

    return post
  })
}
```

## 数据库最佳实践

### 性能优化

#### 1. 索引策略
```sql
-- 常用索引建议
-- 主键索引：自动创建
-- 唯一索引：用户名、邮箱、手机号等
-- 普通索引：查询条件字段
-- 复合索引：多字段查询

-- 示例：文章表索引
ALTER TABLE tb_post 
ADD INDEX idx_category_hide (category, hide),
ADD INDEX idx_date_hide (date, hide),
ADD INDEX idx_user (user_id);
```

#### 2. 避免全表扫描
```typescript
// ❌ 不好的做法
const posts = await prisma.tbPost.findMany({
  where: {
    OR: [
      { title: { contains: keyword } },
      { content: { contains: keyword } },
    ],
  },
})

// ✅ 好的做法
// 1. 添加全文索引
// 2. 限制查询范围
// 3. 使用缓存
const posts = await prisma.tbPost.findMany({
  where: {
    is_delete: 0,
    hide: '0',
    OR: [
      { title: { contains: keyword } },
      { content: { contains: keyword } },
    ],
  },
  take: 20, // 限制结果数量
  orderBy: { date: 'desc' },
})
```

#### 3. 批量操作优化
```typescript
// ❌ N+1 问题
for (const id of userIds) {
  await prisma.tbUser.findUnique({ where: { id } })
}

// ✅ 批量查询
await prisma.tbUser.findMany({
  where: { id: { in: userIds } }
})
```

### 数据完整性

#### 1. 使用事务
```typescript
// 关键操作必须使用事务
await prisma.$transaction(async (tx) => {
  // 多个相关操作
})
```

#### 2. 外键约束
```sql
-- 在迁移脚本中添加外键
ALTER TABLE tb_comment 
ADD CONSTRAINT fk_post 
FOREIGN KEY (post_id) 
REFERENCES tb_post(id) 
ON DELETE CASCADE;

-- 注意：MySQL 5.7+ 需要检查存储引擎
```

#### 3. 数据验证
```typescript
// 服务层验证
export async function createPost(data: any) {
  // 1. 验证必填字段
  if (!data.title || !data.content) {
    throw new Error('标题和内容不能为空')
  }

  // 2. 验证字段长度
  if (data.title.length > 200) {
    throw new Error('标题过长')
  }

  // 3. 验证关联数据
  const user = await getUserById(data.userId)
  if (!user) {
    throw new Error('用户不存在')
  }

  // 4. 执行插入
  return await prisma.tbPost.create({ data })
}
```

### 安全考虑

#### 1. 防止 SQL 注入
```typescript
// ✅ Prisma 自动防护
await prisma.tbUser.findMany({
  where: {
    username: userInput, // 安全
  },
})

// ❌ 避免原生 SQL 拼接
// const query = `SELECT * FROM tb_user WHERE username = '${userInput}'` // 危险！
```

#### 2. 敏感字段保护
```typescript
// 不返回敏感字段
export async function getUserInfo(id: bigint) {
  return await prisma.tbUser.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      nickname: true,
      avatar: true,
      email: true,
      role: true,
      // 不返回：password, token 等
    },
  })
}
```

#### 3. 输入验证
```typescript
import { z } from 'zod'

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const validated = createPostSchema.parse(body)
  // ...
}
```

## 数据库维护

### 备份策略

#### 开发环境
```bash
# 手动备份
mysqldump -u root -p react_blog > backup_dev.sql

# 恢复
mysql -u root -p react_blog < backup_dev.sql
```

#### 生产环境
```bash
# 自动备份脚本
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > /backup/db_$DATE.sql.gz

# 保留最近7天
find /backup -name "*.sql.gz" -mtime +7 -delete
```

### 性能监控

#### 慢查询日志
```sql
-- 查看慢查询
SHOW VARIABLES LIKE 'slow_query%';

-- 开启慢查询日志
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;
```

#### 表状态检查
```sql
-- 检查表状态
SHOW TABLE STATUS LIKE 'tb_post';

-- 优化表
OPTIMIZE TABLE tb_post;

-- 分析表
ANALYZE TABLE tb_post;
```

## 常见问题

### 1. 字段不存在错误
```sql
-- 检查字段是否存在
SELECT COUNT(*) as count
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'tb_user'
  AND column_name = 'new_field';
```

### 2. 迁移回滚
```sql
-- 1. 创建回滚脚本
-- docs/migrations/rollback/20251218_001_rollback.sql

-- 2. 执行回滚
-- 注意：需要根据实际情况编写
```

### 3. 数据冲突
```sql
-- 检查重复数据
SELECT username, COUNT(*) as count
FROM tb_user
GROUP BY username
HAVING count > 1;

-- 删除重复数据（保留最新）
DELETE u1 FROM tb_user u1
INNER JOIN tb_user u2 
WHERE u1.id < u2.id AND u1.username = u2.username;
```

## 开发工作流

### 1. 新功能开发
```bash
# 1. 修改 Schema
vim prisma/schema.prisma

# 2. 生成 Client
pnpm prisma generate

# 3. 编写迁移 SQL
vim docs/migrations/20251218_001_feature.sql

# 4. 本地测试
mysql -u root -p dev_db < docs/migrations/20251218_001_feature.sql

# 5. 更新代码
vim src/services/xxx.ts

# 6. 验证功能
pnpm dev
```

### 2. 团队协作
```bash
# 1. 拉取最新代码
git pull origin main

# 2. 查看新迁移
ls -la docs/migrations/

# 3. 执行迁移
mysql -u root -p dev_db < docs/migrations/20251218_001_new.sql

# 4. 重新生成 Client
pnpm prisma generate
```

### 3. 生产部署
```bash
# 1. 备份数据库
mysqldump -u root -p prod_db > backup_prod.sql

# 2. 执行迁移
mysql -u root -p prod_db < docs/migrations/20251218_001_new.sql

# 3. 重启应用
pm2 restart ecosystem.config.cjs

# 4. 监控日志
pm2 logs
```

## 工具脚本

### 迁移检查脚本
```bash
#!/bin/bash
# scripts/check-migrations.sh

echo "检查未执行的迁移..."
ls -la docs/migrations/*.sql | tail -5

echo ""
echo "数据库当前状态..."
mysql -u root -p -e "SHOW TABLES;" database_name
```

### 数据库状态脚本
```bash
#!/bin/bash
# scripts/db-status.sh

echo "=== 数据库状态 ==="
mysql -u root -p -e "
SELECT 
    table_name,
    table_rows,
    data_length,
    index_length
FROM information_schema.tables
WHERE table_schema = 'database_name'
ORDER BY data_length DESC;
" database_name
```

## 总结

### 核心原则
1. ✅ **手写 SQL 迁移脚本**，不使用 Prisma Migrate
2. ✅ **使用事务**保证数据一致性
3. ✅ **添加索引**优化查询性能
4. ✅ **软删除**保护数据安全
5. ✅ **记录迁移**便于追踪和回滚
6. ✅ **输入验证**防止 SQL 注入
7. ✅ **敏感字段**不返回给前端

### 工作流程
1. 修改 Schema → 2. 编写迁移 SQL → 3. 本地测试 → 4. 提交代码 → 5. 生产执行

### 关键目录
- Schema: `prisma/schema.prisma`
- 迁移: `docs/migrations/`
- 客户端: `src/generated/prisma-client/`
- 服务层: `src/services/`

