/**
 * 实体字段配置
 *
 * 定义哪些实体的哪些字段需要记录变更历史
 * 每个字段可以自定义序列化、反序列化和比较逻辑
 */

import { EntityType, ValueType } from '@/types/entity-change';

/**
 * 字段配置接口
 */
export interface FieldConfig {
  /** 数据库字段名 */
  fieldName: string;
  /** 显示名称（用于前端展示） */
  displayName: string;
  /** 值类型 */
  valueType: ValueType;
  /** 自定义序列化函数（可选） */
  serialize?: (value: unknown) => string;
  /** 自定义反序列化函数（可选） */
  deserialize?: (value: string) => unknown;
  /** 自定义比较函数（可选） */
  compare?: (oldValue: unknown, newValue: unknown) => boolean;
}

/**
 * 实体字段配置映射类型
 */
export type EntityFieldConfigs = Record<string, FieldConfig>;

/**
 * 文章字段配置
 *
 * 需要记录变更的字段：
 * - title, path, tags, date, cover, description, hide, is_delete
 * - github_url, github_repo
 *
 * 不需要记录的字段：
 * - content（已有 TbPostVersion）
 * - like（高频更新）
 * - updated_at（自动更新）
 */
export const postFieldConfigs: EntityFieldConfigs = {
  title: {
    fieldName: 'title',
    displayName: '标题',
    valueType: ValueType.STRING,
  },
  path: {
    fieldName: 'path',
    displayName: '路径',
    valueType: ValueType.STRING,
  },
  tags: {
    fieldName: 'tags',
    displayName: '标签',
    valueType: ValueType.ARRAY,
    serialize: (value) => JSON.stringify(value ?? []),
    deserialize: (value) => (value ? JSON.parse(value) : []),
    compare: (oldValue, newValue) => {
      // 对数组排序后比较，忽略顺序差异
      const oldArr = JSON.stringify(
        Array.isArray(oldValue) ? [...oldValue].sort() : oldValue
      );
      const newArr = JSON.stringify(
        Array.isArray(newValue) ? [...newValue].sort() : newValue
      );
      return oldArr === newArr;
    },
  },
  date: {
    fieldName: 'date',
    displayName: '日期',
    valueType: ValueType.OBJECT,
    serialize: (value) => {
      if (!value) return '';
      // 统一格式化为 ISO 字符串（去除毫秒）
      const date = value instanceof Date ? value : new Date(value as string | number);
      return date.toISOString().split('.')[0] + 'Z';
    },
    deserialize: (value) => (value ? new Date(value) : null),
    compare: (oldValue, newValue) => {
      // 比较日期的时间戳，忽略毫秒级差异
      const oldDate = oldValue instanceof Date ? oldValue : new Date(oldValue as string | number);
      const newDate = newValue instanceof Date ? newValue : new Date(newValue as string | number);

      // 比较到秒级别（忽略毫秒）
      return Math.floor(oldDate.getTime() / 1000) === Math.floor(newDate.getTime() / 1000);
    },
  },
  cover: {
    fieldName: 'cover',
    displayName: '封面',
    valueType: ValueType.STRING,
  },
  description: {
    fieldName: 'description',
    displayName: '描述',
    valueType: ValueType.STRING,
  },
  hide: {
    fieldName: 'hide',
    displayName: '隐藏状态',
    valueType: ValueType.STRING,
  },
  isDelete: {
    fieldName: 'is_delete',
    displayName: '删除状态',
    valueType: ValueType.BOOLEAN,
  },
  githubUrl: {
    fieldName: 'github_url',
    displayName: 'GitHub URL',
    valueType: ValueType.STRING,
  },
  githubRepo: {
    fieldName: 'github_repo',
    displayName: 'GitHub 仓库',
    valueType: ValueType.STRING,
  },
};

/**
 * 合集字段配置
 *
 * 需要记录变更的字段：
 * - name, slug, description, cover, hide, sort_order
 */
export const collectionFieldConfigs: EntityFieldConfigs = {
  name: {
    fieldName: 'name',
    displayName: '合集名称',
    valueType: ValueType.STRING,
  },
  slug: {
    fieldName: 'slug',
    displayName: '合集标识',
    valueType: ValueType.STRING,
  },
  description: {
    fieldName: 'description',
    displayName: '合集描述',
    valueType: ValueType.STRING,
  },
  cover: {
    fieldName: 'cover',
    displayName: '封面',
    valueType: ValueType.STRING,
  },
  hide: {
    fieldName: 'hide',
    displayName: '隐藏状态',
    valueType: ValueType.BOOLEAN,
  },
  sortOrder: {
    fieldName: 'sort_order',
    displayName: '排序',
    valueType: ValueType.NUMBER,
  },
};

/**
 * 获取实体字段配置
 *
 * @param entityType - 实体类型
 * @returns 该实体的字段配置对象
 */
export function getEntityFieldConfigs(
  entityType: EntityType
): EntityFieldConfigs {
  switch (entityType) {
    case EntityType.POST:
      return postFieldConfigs;
    case EntityType.COLLECTION:
      return collectionFieldConfigs;
    default:
      console.warn(`未知的实体类型: ${entityType}`);
      return {};
  }
}
