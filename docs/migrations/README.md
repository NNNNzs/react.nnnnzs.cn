# 数据库迁移说明

## ⚠️ 重要说明

**本项目不使用 Prisma Migrate，必须手写 SQL 迁移脚本！**

## 迁移文件规范

### 文件命名
```
YYYYMMDD_序号_描述.sql
```

示例：
- `20251218_001_initial_schema.sql` - 初始建表
- `20251218_002_add_user_fields.sql` - 添加用户字段
- `20251218_003_create_indexes.sql` - 创建索引

### 文件结构
```sql
-- docs/migrations/20251218_001_description.sql

-- 说明：[功能描述]
-- 作者：[你的名字]
-- 日期：[创建日期]
-- 影响表：[表名]

-- 开始事务
START TRANSACTION;

-- 迁移内容
-- 1. 检查字段是否存在
-- 2. 执行变更
-- 3. 添加索引
-- 4. 更新数据

-- 提交事务
COMMIT;
```

## 迁移类型示例

### 1. 添加字段
```sql
-- docs/migrations/20251218_001_add_phone.sql

-- 说明：为用户表添加手机号字段
-- 作者：张三
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
    
    SELECT '✓ 字段添加成功' AS result;
ELSE
    SELECT '○ 字段已存在，跳过' AS result;
END IF;

COMMIT;
```

### 2. 创建新表
```sql
-- docs/migrations/20251218_002_create_tags.sql

-- 说明：创建标签表
-- 作者：张三
-- 日期：2025-12-18

START TRANSACTION;

-- 检查表是否存在
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
        INDEX idx_name (name),
        INDEX idx_delete (is_delete)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签表';
    
    SELECT '✓ 表创建成功' AS result;
ELSE
    SELECT '○ 表已存在，跳过' AS result;
END IF;

COMMIT;
```

### 3. 添加索引
```sql
-- docs/migrations/20251218_003_add_indexes.sql

-- 说明：为文章表添加复合索引
-- 作者：张三
-- 日期：2025-12-18
-- 影响表：tb_post

START TRANSACTION;

-- 检查索引是否存在
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

### 4. 修改字段类型
```sql
-- docs/migrations/20251218_004_alter_email.sql

-- 说明：修改邮箱字段长度
-- 作者：张三
-- 日期：2025-12-18
-- 影响表：tb_user

START TRANSACTION;

-- 检查当前字段定义
SELECT COLUMN_TYPE INTO @current_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'tb_user'
  AND column_name = 'email';

-- 如果不是 VARCHAR(255)，则修改
IF @current_type != 'varchar(255)' THEN
    ALTER TABLE tb_user 
    MODIFY COLUMN email VARCHAR(255) NULL;
    
    SELECT '✓ 字段类型修改成功' AS result;
ELSE
    SELECT '○ 字段类型已正确，跳过' AS result;
END IF;

COMMIT;
```

### 5. 数据迁移
```sql
-- docs/migrations/20251218_005_migrate_data.sql

-- 说明：迁移旧数据格式
-- 作者：张三
-- 日期：2025-12-18
-- 影响表：tb_post

START TRANSACTION;

-- 示例：将旧的 tags 格式转换为新格式
UPDATE tb_post 
SET tags = REPLACE(tags, ';', ',')
WHERE tags LIKE '%;%';

-- 示例：填充默认值
UPDATE tb_post 
SET hide = '0' 
WHERE hide IS NULL;

-- 示例：更新统计字段
UPDATE tb_user u
SET post_count = (
    SELECT COUNT(*) 
    FROM tb_post p 
    WHERE p.user_id = u.id AND p.is_delete = 0
);

COMMIT;
```

## 执行迁移

### 开发环境
```bash
# 1. 查看待执行的迁移
ls -la docs/migrations/*.sql

# 2. 执行单个迁移
mysql -u root -p react_blog < docs/migrations/20251218_001_add_phone.sql

# 3. 批量执行（按文件名排序）
for file in docs/migrations/*.sql; do
    echo "执行: $file"
    mysql -u root -p react_blog < "$file"
done

# 4. 验证
pnpm prisma db pull
```

### 生产环境
```bash
# 1. 备份数据库
mysqldump -u root -p production_db > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 执行迁移
mysql -u root -p production_db < docs/migrations/20251218_001_add_phone.sql

# 3. 验证
# - 检查应用日志
# - 测试相关功能
# - 监控性能

# 4. 如果出错，回滚
mysql -u root -p production_db < rollback/20251218_001_rollback.sql
```

## 回滚脚本

### 回滚规范
```sql
-- docs/migrations/rollback/20251218_001_rollback.sql

-- 说明：回滚添加手机号字段
-- 作者：张三
-- 日期：2025-12-18
-- 原迁移：20251218_001_add_phone.sql

START TRANSACTION;

-- 检查字段是否存在
SELECT COUNT(*) INTO @column_exists
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'tb_user'
  AND column_name = 'phone';

-- 如果存在则删除
IF @column_exists > 0 THEN
    ALTER TABLE tb_user 
    DROP COLUMN phone;
    
    SELECT '✓ 回滚成功' AS result;
ELSE
    SELECT '○ 字段不存在，跳过' AS result;
END IF;

COMMIT;
```

## 迁移记录

### 创建记录表
```sql
-- docs/migrations/20251218_000_create_history.sql

CREATE TABLE IF NOT EXISTS tb_migration_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    execution_time INT COMMENT '执行时间（毫秒）',
    status ENUM('success', 'failed') NOT NULL,
    error_message TEXT,
    checksum VARCHAR(64) COMMENT '文件校验和',
    INDEX idx_name (migration_name),
    INDEX idx_status (status),
    INDEX idx_executed (executed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='迁移记录表';
```

### 记录迁移执行
```sql
-- 在迁移脚本中添加
INSERT INTO tb_migration_history 
(migration_name, execution_time, status, checksum)
VALUES 
('20251218_001_add_phone.sql', 150, 'success', MD5('file_content'));
```

## 最佳实践

### ✅ 应该做的
1. **总是使用事务** - 保证原子性
2. **检查存在性** - 避免重复执行
3. **添加注释** - 说明迁移目的
4. **测试回滚** - 确保可逆
5. **记录执行** - 便于追踪
6. **备份数据** - 生产环境必须

### ❌ 不应该做的
1. **不要删除字段** - 先软删除，后续清理
2. **不要修改主键** - 影响太大
3. **不要跳过事务** - 可能导致数据不一致
4. **不要在生产环境测试** - 先在开发环境验证
5. **不要忽略错误** - 必须处理异常

## 常见问题

### Q1: 如何检查迁移是否已执行？
```sql
SELECT * FROM tb_migration_history 
WHERE migration_name = '20251218_001_add_phone.sql';
```

### Q2: 迁移失败怎么办？
1. 查看错误信息
2. 检查回滚脚本
3. 执行回滚
4. 修复问题后重新执行

### Q3: 如何查看表结构？
```sql
DESCRIBE tb_user;
SHOW CREATE TABLE tb_user;
```

### Q4: 如何查看索引？
```sql
SHOW INDEX FROM tb_user;
```

## 工具脚本

### 检查待执行迁移
```bash
#!/bin/bash
# scripts/check-pending-migrations.sh

echo "=== 待执行的迁移 ==="
ls -1 docs/migrations/*.sql 2>/dev/null | sort

echo ""
echo "=== 已执行的迁移 ==="
mysql -u root -p -e "SELECT migration_name, executed_at, status FROM tb_migration_history ORDER BY executed_at DESC LIMIT 10;" database_name
```

### 执行所有迁移
```bash
#!/bin/bash
# scripts/run-migrations.sh

DB_NAME="react_blog"
MIGRATIONS_DIR="docs/migrations"

echo "开始执行迁移..."

for file in $(ls -1 $MIGRATIONS_DIR/*.sql | sort); do
    filename=$(basename "$file")
    echo "执行: $filename"
    
    mysql -u root -p $DB_NAME < "$file"
    
    if [ $? -eq 0 ]; then
        echo "✓ 成功"
    else
        echo "✗ 失败"
        exit 1
    fi
done

echo "所有迁移完成！"
```

## 相关文档
- [数据库开发规范](../../.cursor/rules/database.md)
- [后端开发规范](../../.cursor/rules/backend.md)
- [部署文档](../deployment.md)

