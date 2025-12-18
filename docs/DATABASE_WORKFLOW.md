# 数据库工作流程指南

## 概述

本项目使用 **Prisma 作为 ORM**，但**不使用 Prisma Migrate**，而是采用**手写 SQL 迁移脚本**的方式管理数据库变更。

## 技术栈

- **ORM**: Prisma 0.3.27
- **数据库**: MySQL 5.7+
- **迁移方式**: 手写 SQL 脚本
- **迁移目录**: `docs/migrations/`

## 核心原则

### ✅ 必须遵守
1. **手写 SQL 迁移脚本** - 不使用 `prisma migrate`
2. **使用事务** - 保证迁移的原子性
3. **检查存在性** - 避免重复执行
4. **记录迁移** - 便于追踪和回滚
5. **测试回滚** - 确保可逆性

### ❌ 禁止操作
1. **不要直接修改生产数据库** - 必须通过迁移脚本
2. **不要删除字段** - 先软删除，后续清理
3. **不要修改主键** - 影响太大
4. **不要跳过事务** - 可能导致数据不一致

## 完整工作流程

### 场景 1: 添加新字段

#### 步骤 1: 修改 Schema
```bash
# 编辑 prisma/schema.prisma
vim prisma/schema.prisma

# 示例：为用户表添加 phone 字段
model TbUser {
  // ... 现有字段
  phone String?  // 新增字段
}
```

#### 步骤 2: 重新生成 Client
```bash
pnpm prisma generate
```

#### 步骤 3: 编写迁移脚本
```bash
# 创建迁移文件
vim docs/migrations/20251218_003_add_user_phone.sql
```

**迁移脚本内容**:
```sql
-- docs/migrations/20251218_003_add_user_phone.sql

-- 说明：为用户表添加手机号字段
-- 作者：[你的名字]
-- 日期：2025-12-18
-- 影响表：tb_user

START TRANSACTION;

-- 检查字段是否存在
SELECT COUNT(*) INTO @column_exists
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'tb_user'
  AND column_name = 'phone';

-- 如果不存在则添加
IF @column_exists = 0 THEN
    ALTER TABLE tb_user 
    ADD COLUMN phone VARCHAR(20) NULL AFTER email,
    ADD INDEX idx_phone (phone);
    
    -- 记录迁移
    INSERT INTO tb_migration_history 
    (migration_name, execution_time, status, checksum)
    VALUES 
    ('20251218_003_add_user_phone.sql', 0, 'success', MD5('file_content'));
    
    SELECT '✓ 字段添加成功' AS result;
ELSE
    SELECT '○ 字段已存在，跳过' AS result;
END IF;

COMMIT;
```

#### 步骤 4: 本地测试
```bash
# 执行迁移
mysql -u root -p react_blog < docs/migrations/20251218_003_add_user_phone.sql

# 验证
pnpm prisma db pull
```

#### 步骤 5: 更新代码
```bash
# 更新服务层
vim src/services/user.ts

# 示例
export async function updateUserPhone(id: bigint, phone: string) {
  const prisma = await getPrisma()
  return await prisma.tbUser.update({
    where: { id },
    data: { phone, updated_at: new Date() }
  })
}
```

#### 步骤 6: 提交代码
```bash
git add prisma/schema.prisma docs/migrations/20251218_003_add_user_phone.sql src/services/user.ts
git commit -m "feat: 添加用户手机号字段"
git push origin main
```

#### 步骤 7: 生产环境执行
```bash
# 1. 备份数据库
mysqldump -u root -p production_db > backup_20251218.sql

# 2. 执行迁移
mysql -u root -p production_db < docs/migrations/20251218_003_add_user_phone.sql

# 3. 重启应用
pm2 restart ecosystem.config.cjs

# 4. 验证
pm2 logs
```

---

### 场景 2: 创建新表

#### 步骤 1: 修改 Schema
```prisma
// prisma/schema.prisma

model TbTag {
  id          BigInt    @id @default(autoincrement())
  name        String    @unique
  description String?
  created_at  DateTime  @default(now())
  updated_at  DateTime  @updatedAt
  is_delete   Int       @default(0)

  @@map("tb_tag")
}
```

#### 步骤 2: 生成迁移脚本
```bash
vim docs/migrations/20251218_004_create_tag_table.sql
```

**迁移脚本**:
```sql
-- docs/migrations/20251218_004_create_tag_table.sql

START TRANSACTION;

SELECT COUNT(*) INTO @table_exists
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'tb_tag';

IF @table_exists = 0 THEN
    CREATE TABLE tb_tag (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        description VARCHAR(200),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_delete INT DEFAULT 0,
        UNIQUE KEY uk_name (name),
        INDEX idx_delete (is_delete)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签表';
    
    INSERT INTO tb_migration_history 
    (migration_name, execution_time, status, checksum)
    VALUES 
    ('20251218_004_create_tag_table.sql', 0, 'success', MD5('file_content'));
    
    SELECT '✓ 表创建成功' AS result;
ELSE
    SELECT '○ 表已存在，跳过' AS result;
END IF;

COMMIT;
```

#### 步骤 3: 执行并测试
```bash
# 执行迁移
mysql -u root -p react_blog < docs/migrations/20251218_004_create_tag_table.sql

# 生成 Client
pnpm prisma generate

# 测试
pnpm dev
```

---

### 场景 3: 添加索引

#### 步骤 1: 分析需求
```sql
-- 检查现有索引
SHOW INDEX FROM tb_post;

-- 分析慢查询
EXPLAIN SELECT * FROM tb_post WHERE category = 'tech' AND hide = '0';
```

#### 步骤 2: 编写迁移
```bash
vim docs/migrations/20251218_005_add_post_indexes.sql
```

**迁移脚本**:
```sql
-- docs/migrations/20251218_005_add_post_indexes.sql

START TRANSACTION;

-- 复合索引
SELECT COUNT(*) INTO @index_exists
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'tb_post'
  AND index_name = 'idx_category_hide';

IF @index_exists = 0 THEN
    ALTER TABLE tb_post 
    ADD INDEX idx_category_hide (category, hide);
    
    SELECT '✓ 索引添加成功' AS result;
ELSE
    SELECT '○ 索引已存在，跳过' AS result;
END IF;

COMMIT;
```

#### 步骤 3: 验证性能
```bash
# 执行迁移
mysql -u root -p react_blog < docs/migrations/20251218_005_add_post_indexes.sql

# 验证索引
SHOW INDEX FROM tb_post;

# 测试查询性能
EXPLAIN SELECT * FROM tb_post WHERE category = 'tech' AND hide = '0';
```

---

### 场景 4: 数据迁移

#### 步骤 1: 分析数据
```sql
-- 查看需要迁移的数据
SELECT id, tags FROM tb_post WHERE tags LIKE '%;%';

-- 统计数量
SELECT COUNT(*) FROM tb_post WHERE tags LIKE '%;%';
```

#### 步骤 2: 编写迁移
```bash
vim docs/migrations/20251218_006_migrate_tags_format.sql
```

**迁移脚本**:
```sql
-- docs/migrations/20251218_006_migrate_tags_format.sql

START TRANSACTION;

-- 备份原数据（可选）
CREATE TABLE IF NOT EXISTS tb_post_backup_20251218 AS 
SELECT * FROM tb_post WHERE tags LIKE '%;%';

-- 更新数据
UPDATE tb_post 
SET tags = REPLACE(tags, ';', ',')
WHERE tags LIKE '%;%';

-- 验证
SELECT COUNT(*) as updated_count 
FROM tb_post 
WHERE tags LIKE '%,%';

INSERT INTO tb_migration_history 
(migration_name, execution_time, status, checksum)
VALUES 
('20251218_006_migrate_tags_format.sql', 0, 'success', MD5('file_content'));

COMMIT;
```

---

## 工具使用

### 1. 检查迁移状态
```bash
./scripts/check-migrations.sh
```

**输出示例**:
```
=========================================
数据库迁移状态检查
=========================================

1. 数据库连接状态:
  ✓ 连接正常

2. 迁移记录表状态:
  ✓ 表已存在
  总迁移数: 5
  失败数: 0

3. 迁移文件状态:
  迁移文件数: 6
  文件列表:
    - 20251218_001_initial_schema.sql (1234 bytes)
    - 20251218_002_add_user_phone.sql (567 bytes)

4. 待执行的迁移:
  发现 1 个待执行迁移:
    ○ 20251218_003_add_user_phone.sql

5. 最近的迁移记录:
  ┌─────────────────────────┬────────────────────┬────────────┬─────────┐
  │ 迁移名称                │ 执行时间           │ 耗时(ms)   │ 状态    │
  ├─────────────────────────┼────────────────────┼────────────┼─────────┤
  │ 20251218_002_...        │ 2025-12-18 10:30:15│ 120        │ success │
  └─────────────────────────┴────────────────────┴────────────┴─────────┘
```

### 2. 执行迁移
```bash
# 开发环境
./scripts/run-migrations.sh dev

# 生产环境
./scripts/run-migrations.sh prod
```

**执行过程**:
```
=========================================
数据库迁移执行工具
环境: dev
数据库: react_blog
迁移目录: /path/to/project/docs/migrations
=========================================

检查迁移记录表...
获取已执行的迁移列表...
扫描待执行的迁移...
发现 1 个待执行的迁移:
  - 20251218_003_add_user_phone.sql

是否执行这些迁移? (y/N): y

开始执行迁移...

-----------------------------------------
执行: 20251218_003_add_user_phone.sql
-----------------------------------------
✓ 成功 (耗时: 45ms)

=========================================
✓ 所有迁移执行完成！
总耗时: 0 秒
执行数量: 1
=========================================
```

---

## 回滚操作

### 场景: 需要回滚某个迁移

#### 步骤 1: 创建回滚脚本
```bash
vim docs/migrations/rollback/20251218_003_rollback.sql
```

**回滚脚本**:
```sql
-- docs/migrations/rollback/20251218_003_rollback.sql

-- 说明：回滚添加手机号字段
-- 原迁移：20251218_003_add_user_phone.sql

START TRANSACTION;

SELECT COUNT(*) INTO @column_exists
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'tb_user'
  AND column_name = 'phone';

IF @column_exists > 0 THEN
    ALTER TABLE tb_user 
    DROP INDEX idx_phone;
    
    ALTER TABLE tb_user 
    DROP COLUMN phone;
    
    SELECT '✓ 回滚成功' AS result;
ELSE
    SELECT '○ 字段不存在，跳过' AS result;
END IF;

COMMIT;
```

#### 步骤 2: 执行回滚
```bash
mysql -u root -p react_blog < docs/migrations/rollback/20251218_003_rollback.sql
```

---

## 常见问题

### Q1: 如何查看表结构？
```sql
DESCRIBE tb_user;
SHOW CREATE TABLE tb_user;
```

### Q2: 如何查看索引？
```sql
SHOW INDEX FROM tb_user;
```

### Q3: 迁移失败怎么办？
1. 查看错误信息
2. 检查回滚脚本
3. 执行回滚
4. 修复问题后重新执行

### Q4: 如何跳过某个迁移？
在迁移脚本中添加判断逻辑：
```sql
-- 如果已手动处理，可以跳过
SELECT '○ 已手动处理，跳过' AS result;
```

### Q5: 如何查看迁移历史？
```sql
SELECT * FROM tb_migration_history ORDER BY executed_at DESC;
```

---

## 最佳实践清单

### 开发阶段
- [ ] 修改 Schema 前备份当前状态
- [ ] 编写迁移脚本时添加详细注释
- [ ] 在开发环境充分测试
- [ ] 验证回滚脚本可用性
- [ ] 更新相关文档

### 测试阶段
- [ ] 在测试环境执行迁移
- [ ] 验证所有功能正常
- [ ] 检查性能影响
- [ ] 测试边界情况

### 生产部署
- [ ] 备份生产数据库
- [ ] 在低峰期执行
- [ ] 准备回滚方案
- [ ] 监控应用日志
- [ ] 验证数据完整性

### 团队协作
- [ ] 迁移文件命名规范
- [ ] 代码审查包含迁移脚本
- [ ] 更新迁移文档
- [ ] 通知团队成员

---

## 相关文档

- [数据库开发规范](../.cursor/rules/database.md)
- [迁移脚本说明](migrations/README.md)
- [后端开发规范](../.cursor/rules/backend.md)
- [部署文档](deployment.md)

---

## 快速参考

### 常用命令
```bash
# 检查状态
./scripts/check-migrations.sh

# 执行迁移
./scripts/run-migrations.sh dev

# 查看表结构
mysql -u root -p -e "DESCRIBE tb_user;" react_blog

# 查看迁移历史
mysql -u root -p -e "SELECT * FROM tb_migration_history ORDER BY executed_at DESC;" react_blog
```

### 迁移文件模板
```sql
-- docs/migrations/YYYYMMDD_XXX_description.sql

-- 说明：[功能描述]
-- 作者：[姓名]
-- 日期：[日期]
-- 影响表：[表名]

START TRANSACTION;

-- 检查存在性
SELECT COUNT(*) INTO @xxx_exists
FROM information_schema.xxx
WHERE ...;

-- 执行变更
IF @xxx_exists = 0 THEN
    -- 执行操作
    -- 记录迁移
    SELECT '✓ 成功' AS result;
ELSE
    SELECT '○ 已存在，跳过' AS result;
END IF;

COMMIT;
```

---

**最后更新**: 2025-12-18

