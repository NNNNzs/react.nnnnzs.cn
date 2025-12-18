# 数据库快速开始指南

## 📋 概述

本项目使用 **Prisma ORM** + **手写 SQL 迁移脚本** 的方式管理数据库。

**⚠️ 重要**: 不使用 Prisma Migrate，所有数据库变更必须手写 SQL 脚本！

---

## 🎯 3 步开始使用

### 第 1 步：了解规范
```bash
# 阅读数据库开发规范
cat .cursor/rules/database.md

# 阅读工作流程指南
cat docs/DATABASE_WORKFLOW.md
```

### 第 2 步：检查当前状态
```bash
# 检查数据库和迁移状态
./scripts/check-migrations.sh
```

### 第 3 步：执行迁移（如果是新环境）
```bash
# 执行所有待执行的迁移
./scripts/run-migrations.sh dev
```

---

## 📝 常见场景

### 场景 1：添加新字段

```bash
# 1. 修改 Schema
vim prisma/schema.prisma
# 添加: phone String?

# 2. 生成 Client
pnpm prisma generate

# 3. 编写迁移脚本
vim docs/migrations/20251218_003_add_phone.sql

# 4. 测试执行
mysql -u root -p react_blog < docs/migrations/20251218_003_add_phone.sql

# 5. 更新代码
vim src/services/user.ts
```

**迁移脚本模板**:
```sql
-- docs/migrations/20251218_003_add_phone.sql
START TRANSACTION;

SELECT COUNT(*) INTO @column_exists
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'tb_user'
  AND column_name = 'phone';

IF @column_exists = 0 THEN
    ALTER TABLE tb_user 
    ADD COLUMN phone VARCHAR(20) NULL AFTER email,
    ADD INDEX idx_phone (phone);
    
    SELECT '✓ 成功' AS result;
ELSE
    SELECT '○ 已存在' AS result;
END IF;

COMMIT;
```

### 场景 2：创建新表

```bash
# 1. 修改 Schema
vim prisma/schema.prisma
# 添加新 model

# 2. 编写迁移
vim docs/migrations/20251218_004_create_table.sql

# 3. 执行并测试
mysql -u root -p react_blog < docs/migrations/20251218_004_create_table.sql
pnpm prisma generate
```

**迁移脚本模板**:
```sql
-- docs/migrations/20251218_004_create_table.sql
START TRANSACTION;

SELECT COUNT(*) INTO @table_exists
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'tb_new_table';

IF @table_exists = 0 THEN
    CREATE TABLE tb_new_table (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_delete INT DEFAULT 0,
        INDEX idx_delete (is_delete)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    
    SELECT '✓ 成功' AS result;
ELSE
    SELECT '○ 已存在' AS result;
END IF;

COMMIT;
```

### 场景 3：添加索引

```bash
# 1. 分析查询
EXPLAIN SELECT * FROM tb_post WHERE category = 'tech';

# 2. 编写迁移
vim docs/migrations/20251218_005_add_index.sql

# 3. 执行
mysql -u root -p react_blog < docs/migrations/20251218_005_add_index.sql
```

**迁移脚本**:
```sql
-- docs/migrations/20251218_005_add_index.sql
START TRANSACTION;

SELECT COUNT(*) INTO @index_exists
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'tb_post'
  AND index_name = 'idx_category_hide';

IF @index_exists = 0 THEN
    ALTER TABLE tb_post 
    ADD INDEX idx_category_hide (category, hide);
    
    SELECT '✓ 成功' AS result;
ELSE
    SELECT '○ 已存在' AS result;
END IF;

COMMIT;
```

---

## 🔧 常用命令

### 检查状态
```bash
./scripts/check-migrations.sh
```

### 执行迁移
```bash
# 开发环境
./scripts/run-migrations.sh dev

# 生产环境
./scripts/run-migrations.sh prod
```

### 手动执行
```bash
# 执行单个迁移
mysql -u root -p react_blog < docs/migrations/20251218_XXX.sql

# 查看表结构
mysql -u root -p -e "DESCRIBE tb_user;" react_blog

# 查看迁移历史
mysql -u root -p -e "SELECT * FROM tb_migration_history;" react_blog
```

### 生成和查看
```bash
# 生成 Prisma Client
pnpm prisma generate

# 查看 Schema
pnpm prisma studio
```

---

## 📋 迁移文件规范

### 命名格式
```
YYYYMMDD_序号_描述.sql
```

示例：
- `20251218_001_initial_schema.sql`
- `20251218_002_add_user_phone.sql`
- `20251218_003_create_tag_table.sql`

### 文件结构
```sql
-- 说明：[功能描述]
-- 作者：[姓名]
-- 日期：[日期]
-- 影响表：[表名]

START TRANSACTION;

-- 检查存在性
SELECT COUNT(*) INTO @xxx_exists ...;

-- 执行变更
IF @xxx_exists = 0 THEN
    -- 操作
    SELECT '✓ 成功' AS result;
ELSE
    SELECT '○ 已存在' AS result;
END IF;

COMMIT;
```

---

## ✅ 最佳实践

### 开发时
1. ✅ 先阅读规范
2. ✅ 检查当前状态
3. ✅ 编写迁移脚本
4. ✅ 本地测试
5. ✅ 验证回滚

### 部署时
1. ✅ 备份数据库
2. ✅ 检查待执行迁移
3. ✅ 执行迁移
4. ✅ 验证功能
5. ✅ 监控日志

### 团队协作
1. ✅ 规范命名
2. ✅ 代码审查
3. ✅ 更新文档
4. ✅ 通知团队

---

## ❌ 常见错误

### 错误 1：忘记使用事务
```sql
-- ❌ 错误
ALTER TABLE tb_user ADD COLUMN phone VARCHAR(20);

-- ✅ 正确
START TRANSACTION;
ALTER TABLE tb_user ADD COLUMN phone VARCHAR(20);
COMMIT;
```

### 错误 2：不检查存在性
```sql
-- ❌ 错误（重复执行会失败）
ALTER TABLE tb_user ADD COLUMN phone VARCHAR(20);

-- ✅ 正确
SELECT COUNT(*) INTO @column_exists ...;
IF @column_exists = 0 THEN
    ALTER TABLE tb_user ADD COLUMN phone VARCHAR(20);
END IF;
```

### 错误 3：直接修改生产数据库
```bash
# ❌ 错误
mysql -u root -p production_db -e "ALTER TABLE tb_user ADD COLUMN phone VARCHAR(20);"

# ✅ 正确
# 1. 编写迁移脚本
# 2. 测试
# 3. 备份
# 4. 执行迁移脚本
```

---

## 🆘 遇到问题？

### 问题 1：迁移失败
```bash
# 1. 查看错误
cat docs/migrations/20251218_XXX.sql

# 2. 检查回滚脚本
ls docs/migrations/rollback/

# 3. 执行回滚
mysql -u root -p react_blog < docs/migrations/rollback/20251218_XXX_rollback.sql
```

### 问题 2：字段已存在
```bash
# 检查字段
mysql -u root -p -e "DESCRIBE tb_user;" react_blog

# 如果确实存在，跳过该迁移
# 或编写回滚脚本删除后重新执行
```

### 问题 3：不确定当前状态
```bash
# 查看完整状态
./scripts/check-migrations.sh
```

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [数据库开发规范](../.cursor/rules/database.md) | 完整规范和最佳实践 |
| [工作流程指南](DATABASE_WORKFLOW.md) | 详细工作流程 |
| [迁移脚本说明](migrations/README.md) | 迁移脚本模板 |
| [后端规范](../.cursor/rules/backend.md) | API 和服务层规范 |

---

## 🎓 学习路径

1. **基础** (5分钟)
   - 阅读本指南
   - 运行 `./scripts/check-migrations.sh`

2. **实践** (15分钟)
   - 查看示例迁移脚本
   - 尝试修改 Schema
   - 编写一个迁移脚本

3. **进阶** (30分钟)
   - 阅读完整规范
   - 学习工作流程
   - 掌握回滚操作

---

## 💡 提示

### 快速查找
```bash
# 查看所有迁移文件
ls -1 docs/migrations/*.sql

# 查看待执行迁移
./scripts/check-migrations.sh | grep "待执行"

# 查看最近迁移
mysql -u root -p -e "SELECT * FROM tb_migration_history LIMIT 5;" react_blog
```

### 常用 SQL
```sql
-- 查看表结构
DESCRIBE tb_user;

-- 查看索引
SHOW INDEX FROM tb_user;

-- 查看表大小
SELECT table_name, table_rows 
FROM information_schema.tables 
WHERE table_schema = DATABASE();

-- 分析查询
EXPLAIN SELECT * FROM tb_post WHERE category = 'tech';
```

---

**最后更新**: 2025-12-18

