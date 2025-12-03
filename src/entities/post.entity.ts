/**
 * 文章实体
 * 参考 api.nnnnzs.cn/src/post/entities/post.entity.ts
 */

// 确保 reflect-metadata 已导入（在 data-source.ts 中已导入，这里作为双重保险）
import 'reflect-metadata';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
// 导入通用的 safe transformer（方案二：兼容现有 varchar 列类型）
import { createSafeArrayTransformer } from '@/lib/transformers';

@Entity('tb_post', { schema: 'system' })
export class TbPost {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id!: number;

  @Column('varchar', { name: 'path', nullable: true, length: 255 })
  path!: string | null;

  @Column('varchar', { name: 'title', nullable: true, length: 255 })
  title!: string | null;

  @Column('varchar', { name: 'category', nullable: true, length: 255 })
  category!: string | null;

  /**
   * 标签字段
   * 
   * 当前使用方案：通用的 Safe Transformer（兼容现有 varchar 列类型）
   * - 自动处理字符串 ↔ 数组转换
   * - 支持 trim、filterEmpty 等自定义选项
   * - 完全兼容现有数据库列类型（varchar(255)）
   * - 防御性处理，兼容多种输入格式
   * 
   * 备选方案一：使用 TypeORM 内置的 simple-array 类型
   * - 优点：代码更简洁，TypeORM 官方支持
   * - 缺点：在 MySQL 中会使用 text 类型，可能需要迁移现有列
   * ```typescript
   * @Column('simple-array', { 
   *   name: 'tags', 
   *   nullable: true,
   * })
   * tags!: string[] | null;
   * ```
   */
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

  @Column('datetime', { name: 'date', nullable: true })
  date!: Date | null | string;

  @Column('datetime', { name: 'updated', nullable: true })
  updated!: Date | string | null;

  @Column('varchar', { name: 'cover', nullable: true, length: 255 })
  cover!: string | null;

  @Column('varchar', { name: 'layout', nullable: true, length: 255 })
  layout!: string | null;

  @Column('text', { name: 'content', nullable: true })
  content!: string | null;

  @Column('varchar', { name: 'description', nullable: true })
  description?: string;

  @Column('int', { name: 'visitors', nullable: true, default: 0 })
  visitors?: number | null;

  @Column('int', { name: 'likes', nullable: true, default: 0 })
  likes?: number | null;

  @Column('varchar', { name: 'hide', nullable: true, default: '0' })
  hide?: string;

  @Column('int', { name: 'is_delete', nullable: false, default: 0 })
  is_delete?: number;
}

