# 长期Token表迁移说明

## ⚠️ 重要：MySQL索引长度限制

### 问题
MySQL的InnoDB引擎对索引键长度有限制：
- **默认限制**: 767字节
- **utf8mb4字符集**: 每个字符最多4字节
- **VARCHAR(255)**: 255 × 4 = 1020字节 > 767字节 ❌

### 解决方案
将`token`字段长度调整为**191字符**：
- 191 × 4 = 764字节 < 767字节 ✅
- 足够容纳我们的Token格式：`LTK_` + 32字符UUID = 36字符

### Token格式验证
```javascript
// 生成的Token格式
LTK_22EC625D12924AA0B0E814C54CFF3FB3
// 长度: 36字符 << 191字符限制 ✅
```

## 执行迁移

### 方法1: 手动执行（推荐）
```bash
mysql -u your_user -p your_database < migration.sql
```

### 方法2: 使用MySQL客户端
```sql
-- 连接数据库后执行
SOURCE /path/to/migration.sql;
```

### 方法3: 使用Prisma（如果已配置）
```bash
# 注意: 需要先配置prisma config
npx prisma migrate deploy
```

## 验证迁移

### 1. 检查表结构
```sql
DESCRIBE long_term_token;
```

### 2. 检查索引
```sql
SHOW INDEX FROM long_term_token;
```

### 3. 检查外键
```sql
SELECT
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_NAME = 'tb_user';
```

## 回滚操作

### 执行回滚
```bash
mysql -u your_user -p your_database < rollback.sql
```

### 验证回滚
```sql
SHOW TABLES LIKE 'long_term_token';
-- 应该返回空结果
```

## 常见问题

### Q: 如果我已经有VARCHAR(255)的索引怎么办？
A: 需要先删除旧索引，再创建新索引：
```sql
ALTER TABLE long_term_token DROP INDEX token_unique;
ALTER TABLE long_term_token MODIFY COLUMN token VARCHAR(191) NOT NULL;
ALTER TABLE long_term_token ADD UNIQUE KEY token_unique (token);
```

### Q: 如何检查当前MySQL的索引长度限制？
```sql
SHOW VARIABLES LIKE 'innodb_large_prefix';
SHOW VARIABLES LIKE 'innodb_file_format';
```

### Q: 如果需要更长的Token怎么办？
A: 可以考虑：
1. 使用SHA256哈希存储（64字符）
2. 使用Redis存储完整Token
3. 配置MySQL支持更大的索引（需要MySQL 5.7+且配置特殊参数）

## 技术细节

### 为什么是191？
- MySQL 5.6+ 默认索引限制：767字节
- utf8mb4：每个字符最多4字节
- 767 ÷ 4 = 191.75 → 取整191

### Token生成代码验证
```typescript
// src/services/token.ts
const token = `LTK_${generateToken()}`;
// generateToken() 返回32字符UUID
// 总长度：4 + 32 = 36字符 ✅
```

### 数据库兼容性
- ✅ MySQL 5.7+
- ✅ MySQL 8.0+
- ✅ MariaDB 10.2+
- ⚠️ MySQL 5.6（需要额外配置）

## 相关文件
- `migration.sql` - 迁移脚本
- `rollback.sql` - 回滚脚本
- `../../schema.prisma` - Prisma schema
- `../../src/services/token.ts` - Token生成逻辑