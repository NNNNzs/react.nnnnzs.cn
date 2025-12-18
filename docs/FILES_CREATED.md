# 新增文件清单

## Cursor Rules (数据库相关)

### 1. 数据库开发规范
**文件**: `.cursor/rules/database.md`  
**说明**: 完整的数据库开发规范，包括：
- Prisma Schema 定义规范
- 手写 SQL 迁移脚本规范
- 数据库操作最佳实践
- 性能优化建议
- 安全考虑

**核心原则**: ⚠️ **不使用 Prisma Migrate，必须手写 SQL 迁移脚本**

---

## 迁移脚本

### 2. 迁移脚本说明
**文件**: `docs/migrations/README.md`  
**说明**: 
- 迁移文件命名规范
- 迁移脚本模板
- 执行和回滚方法
- 最佳实践

### 3. 初始数据库结构
**文件**: `docs/migrations/20251218_001_initial_schema.sql`  
**说明**: 创建所有基础表（用户、文章、评论、标签、配置、迁移记录）

### 4. 示例迁移：添加字段
**文件**: `docs/migrations/20251218_002_add_user_phone.sql`  
**说明**: 为用户表添加手机号字段的示例

### 5. 回滚脚本示例
**文件**: `docs/migrations/rollback/20251218_002_rollback.sql`  
**说明**: 回滚添加手机号字段的示例

---

## 工具脚本

### 6. 迁移执行脚本
**文件**: `scripts/run-migrations.sh`  
**权限**: `chmod +x`  
**功能**:
- 自动检测待执行迁移
- 支持开发/生产环境
- 记录执行历史
- 显示进度和耗时

**使用方法**:
```bash
./scripts/run-migrations.sh dev    # 开发环境
./scripts/run-migrations.sh prod   # 生产环境
```

### 7. 迁移状态检查脚本
**文件**: `scripts/check-migrations.sh`  
**权限**: `chmod +x`  
**功能**:
- 检查数据库连接
- 显示迁移记录
- 列出待执行迁移
- 显示表结构信息

**使用方法**:
```bash
./scripts/check-migrations.sh
```

---

## 文档更新

### 8. 数据库工作流程指南
**文件**: `docs/DATABASE_WORKFLOW.md`  
**说明**: 完整的工作流程，包括：
- 添加字段的完整流程
- 创建新表的步骤
- 添加索引的方法
- 数据迁移示例
- 回滚操作
- 常见问题解答

### 9. 后端规范更新
**文件**: `.cursor/rules/backend.md`  
**更新内容**:
- 添加数据库集成章节
- 引用数据库规范文档
- 添加数据库测试建议

### 10. 脚本说明更新
**文件**: `scripts/README.md`  
**更新内容**:
- 添加迁移脚本说明
- 添加状态检查脚本说明
- 更新脚本清单

---

## 目录结构

```
project/
├── .cursor/rules/
│   ├── backend.md          # 更新：添加数据库章节
│   └── database.md         # 新增：数据库开发规范
│
├── docs/
│   ├── DATABASE_WORKFLOW.md    # 新增：工作流程指南
│   ├── migrations/
│   │   ├── README.md            # 新增：迁移说明
│   │   ├── 20251218_001_initial_schema.sql
│   │   ├── 20251218_002_add_user_phone.sql
│   │   └── rollback/
│   │       └── 20251218_002_rollback.sql
│   └── FILES_CREATED.md         # 更新：本文件
│
├── scripts/
│   ├── README.md           # 更新：添加迁移脚本说明
│   ├── run-migrations.sh   # 新增：迁移执行脚本
│   └── check-migrations.sh # 新增：状态检查脚本
│
└── prisma/
    └── schema.prisma       # 现有：Prisma Schema
```

---

## 快速开始

### 首次使用

1. **查看数据库规范**
   ```bash
   # 阅读数据库开发规范
   cat .cursor/rules/database.md
   ```

2. **检查迁移状态**
   ```bash
   ./scripts/check-migrations.sh
   ```

3. **执行初始迁移**
   ```bash
   # 如果是新数据库
   mysql -u root -p react_blog < docs/migrations/20251218_001_initial_schema.sql
   ```

### 日常开发

1. **修改 Schema**
   ```bash
   vim prisma/schema.prisma
   pnpm prisma generate
   ```

2. **编写迁移脚本**
   ```bash
   vim docs/migrations/20251218_XXX_description.sql
   ```

3. **测试迁移**
   ```bash
   mysql -u root -p react_blog < docs/migrations/20251218_XXX_description.sql
   ```

4. **检查状态**
   ```bash
   ./scripts/check-migrations.sh
   ```

5. **更新代码**
   ```bash
   vim src/services/xxx.ts
   ```

---

## 核心原则回顾

### ✅ 必须做的
1. **手写 SQL 迁移脚本**
2. **使用事务保证原子性**
3. **检查字段/表是否存在**
4. **记录迁移执行历史**
5. **测试回滚脚本**

### ❌ 禁止做的
1. **不使用 Prisma Migrate**
2. **不直接修改生产数据库**
3. **不删除字段（软删除）**
4. **不修改主键**
5. **不跳过事务**

---

## 常用命令速查

```bash
# 检查迁移状态
./scripts/check-migrations.sh

# 执行迁移
./scripts/run-migrations.sh dev

# 查看表结构
mysql -u root -p -e "DESCRIBE tb_user;" react_blog

# 查看迁移历史
mysql -u root -p -e "SELECT * FROM tb_migration_history;" react_blog

# 生成 Prisma Client
pnpm prisma generate

# 查看 Schema
pnpm prisma studio
```

---

## 相关资源

- **数据库规范**: `.cursor/rules/database.md`
- **工作流程**: `docs/DATABASE_WORKFLOW.md`
- **迁移说明**: `docs/migrations/README.md`
- **后端规范**: `.cursor/rules/backend.md`
- **脚本说明**: `scripts/README.md`

---

**创建日期**: 2025-12-18  
**最后更新**: 2025-12-18
