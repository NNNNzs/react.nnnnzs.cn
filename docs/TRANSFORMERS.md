# TypeORM Transformer 使用指南

本文档介绍如何在项目中使用 TypeORM Transformer 处理数据格式转换。

## 📋 概述

在数据库中，某些字段可能以特定格式存储（如逗号分隔的字符串），但在应用层我们希望使用更友好的数据类型（如数组）。TypeORM Transformer 可以帮助我们自动处理这种转换。

## 🎯 使用场景

### 场景一：标签字段（Tags）

**需求**：数据库存储逗号分隔的字符串 `"tag1,tag2,tag3"`，应用层使用数组 `["tag1", "tag2", "tag3"]`

## 💡 解决方案

### 方案一：使用 TypeORM 内置的 `simple-array` 类型（推荐）

**优点**：
- ✅ TypeORM 官方支持，稳定可靠
- ✅ 自动处理转换，无需手动编写 transformer
- ✅ 代码简洁，易于维护

**缺点**：
- ⚠️ 在 MySQL 中会使用 `text` 类型，如果现有列是 `varchar(255)` 可能需要迁移
- ⚠️ 不支持自定义处理（如 trim、filterEmpty）

**使用示例**：

```typescript
import { Entity, Column } from 'typeorm';

@Entity('tb_post')
export class TbPost {
  @Column('simple-array', { 
    name: 'tags', 
    nullable: true,
  })
  tags!: string[] | null;
}
```

**注意事项**：
- `simple-array` 在 MySQL 中底层使用 `text` 类型
- 如果现有数据库列是 `varchar(255)`，TypeORM 在开发环境（`synchronize: true`）可能会尝试修改列类型
- 生产环境建议使用迁移脚本，而不是 `synchronize`

### 方案二：使用通用的 Safe Transformer 包装器

**优点**：
- ✅ 完全兼容现有数据库列类型（`varchar`）
- ✅ 支持自定义选项（trim、filterEmpty、separator）
- ✅ 防御性处理，兼容多种输入格式
- ✅ 可复用，适用于其他类似场景

**缺点**：
- ⚠️ 需要手动导入和使用

**使用示例**：

```typescript
import { Entity, Column } from 'typeorm';
import { createSafeArrayTransformer } from '@/lib/transformers';

@Entity('tb_post')
export class TbPost {
  @Column('varchar', {
    name: 'tags',
    nullable: true,
    length: 255,
    transformer: createSafeArrayTransformer({
      trim: true,        // 自动去除空格
      filterEmpty: true,  // 过滤空值
      separator: ',',    // 分隔符
      defaultValue: [],  // 默认值
    }),
  })
  tags!: string[] | null;
}
```

**Transformer 选项说明**：

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `trim` | `boolean` | `true` | 是否自动去除每个元素的前后空格 |
| `filterEmpty` | `boolean` | `true` | 是否过滤空字符串 |
| `separator` | `string` | `','` | 数组元素之间的分隔符 |
| `defaultValue` | `string[]` | `[]` | 当值为 null/undefined 时返回的默认值 |

## 🔧 其他 Transformer 工具

### JSON Transformer

如果需要存储 JSON 数据，可以使用 `createSafeJsonTransformer`：

```typescript
import { createSafeJsonTransformer } from '@/lib/transformers';

@Column('text', {
  name: 'metadata',
  nullable: true,
  transformer: createSafeJsonTransformer<Record<string, any>>({
    defaultValue: {},
  }),
})
metadata!: Record<string, any> | null;
```

## 📝 最佳实践

1. **优先使用 `simple-array`**：如果数据库列类型可以修改，优先使用 TypeORM 内置类型
2. **使用 Safe Transformer**：如果需要兼容现有列类型或需要自定义处理，使用 `createSafeArrayTransformer`
3. **生产环境禁用 synchronize**：生产环境应该使用迁移脚本，而不是自动同步
4. **防御性编程**：在 Service 层添加额外的类型检查，确保数据格式正确

## 🐛 常见问题

### Q: `simple-array` 类型在 MySQL 中会使用什么列类型？

A: `simple-array` 在 MySQL 中会使用 `text` 类型。如果现有列是 `varchar(255)`，TypeORM 可能会尝试修改列类型。

### Q: 如何避免 TypeORM 修改现有列类型？

A: 
1. 生产环境禁用 `synchronize: false`
2. 使用迁移脚本手动管理列类型变更
3. 使用 `createSafeArrayTransformer` 保持现有列类型

### Q: Transformer 在哪些情况下可能失效？

A: 
- 使用 `select` 指定字段时，某些情况下 transformer 可能不会应用
- 直接使用 QueryBuilder 的 `select` 时
- 数据序列化/反序列化过程中

**解决方案**：在 Service 层添加防御性检查（参考 `src/services/post.ts` 中的 `ensureTagsIsArray` 函数）

## 📚 参考资源

- [TypeORM Entity 文档](https://typeorm.io/entities)
- [TypeORM Column Types](https://typeorm.io/entities#column-types)
- [TypeORM ValueTransformer](https://github.com/typeorm/typeorm/blob/master/docs/entities.md#column-transformer)
