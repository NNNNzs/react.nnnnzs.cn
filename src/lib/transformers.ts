/**
 * TypeORM 通用 Transformer 工具
 * 提供常用的数据转换器，用于处理数据库存储格式与应用层格式的转换
 */

import { ValueTransformer } from 'typeorm';

/**
 * 创建安全的字符串数组转换器
 * 自动处理 string → array 和 array → string 的转换
 * 
 * @param options 转换选项
 * @returns ValueTransformer 实例
 * 
 * @example
 * ```typescript
 * @Column('varchar', {
 *   transformer: createSafeArrayTransformer({
 *     trim: true,        // 自动去除空格
 *     filterEmpty: true,  // 过滤空值
 *     separator: ','      // 分隔符，默认逗号
 *   })
 * })
 * tags!: string[] | null;
 * ```
 */
export function createSafeArrayTransformer(options?: {
  /** 是否自动去除空格，默认 true */
  trim?: boolean;
  /** 是否过滤空值，默认 true */
  filterEmpty?: boolean;
  /** 分隔符，默认 ',' */
  separator?: string;
  /** 默认值，当值为 null/undefined 时返回，默认 [] */
  defaultValue?: string[];
}): ValueTransformer {
  const {
    trim = true,
    filterEmpty = true,
    separator = ',',
    defaultValue = [],
  } = options || {};

  return {
    /**
     * 从数据库读取时：字符串 -> 数组
     */
    to: (value: string | null | undefined): string[] => {
      if (value === null || value === undefined || value === '') {
        return defaultValue;
      }

      if (typeof value !== 'string') {
        // 如果已经是数组（防御性处理）
        if (Array.isArray(value)) {
          return value;
        }
        console.warn('⚠️ 期望字符串类型，但收到:', typeof value, value);
        return defaultValue;
      }

      let array = value.split(separator);

      if (trim) {
        array = array.map(item => item.trim());
      }

      if (filterEmpty) {
        array = array.filter(Boolean);
      }

      return array;
    },

    /**
     * 保存到数据库时：数组 -> 字符串
     */
    from: (value: string[] | string | null | undefined): string | null => {
      if (value === null || value === undefined) {
        return null;
      }

      // 如果已经是字符串（兼容旧数据或直接传入字符串的情况）
      if (typeof value === 'string') {
        return value;
      }

      // 如果是数组
      if (Array.isArray(value)) {
        let array = value;

        if (filterEmpty) {
          array = array.filter(Boolean);
        }

        if (trim) {
          array = array.map(item => String(item).trim());
        }

        return array.length > 0 ? array.join(separator) : null;
      }

      console.warn('⚠️ 期望数组或字符串类型，但收到:', typeof value, value);
      return null;
    },
  };
}

/**
 * 创建安全的 JSON 转换器
 * 自动处理对象/数组 ↔ JSON 字符串的转换
 * 
 * @param options 转换选项
 * @returns ValueTransformer 实例
 * 
 * @example
 * ```typescript
 * @Column('text', {
 *   transformer: createSafeJsonTransformer({
 *     defaultValue: {}  // 默认值
 *   })
 * })
 * metadata!: Record<string, any> | null;
 * ```
 */
export function createSafeJsonTransformer<T = unknown>(options?: {
  /** 默认值，当值为 null/undefined 时返回 */
  defaultValue?: T;
}): ValueTransformer {
  const { defaultValue = null } = options || {};

  return {
    /**
     * 从数据库读取时：JSON 字符串 -> 对象/数组
     */
    to: (value: string | null | undefined): T | null => {
      if (value === null || value === undefined || value === '') {
        return defaultValue as T | null;
      }

      if (typeof value !== 'string') {
        // 如果已经是对象（防御性处理）
        if (typeof value === 'object') {
          return value as T;
        }
        console.warn('⚠️ 期望 JSON 字符串类型，但收到:', typeof value, value);
        return defaultValue as T | null;
      }

      try {
        return JSON.parse(value) as T;
      } catch (error) {
        console.error('❌ JSON 解析失败:', error, '原始值:', value);
        return defaultValue as T | null;
      }
    },

    /**
     * 保存到数据库时：对象/数组 -> JSON 字符串
     */
    from: (value: T | string | null | undefined): string | null => {
      if (value === null || value === undefined) {
        return null;
      }

      // 如果已经是字符串（兼容旧数据）
      if (typeof value === 'string') {
        try {
          // 验证是否为有效的 JSON
          JSON.parse(value);
          return value;
        } catch {
          // 如果不是有效 JSON，尝试序列化
          return JSON.stringify(value);
        }
      }

      // 如果是对象或数组
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch (error) {
          console.error('❌ JSON 序列化失败:', error, '值:', value);
          return null;
        }
      }

      console.warn('⚠️ 期望对象或数组类型，但收到:', typeof value, value);
      return null;
    },
  };
}
