/**
 * 文章实体
 * 参考 api.nnnnzs.cn/src/post/entities/post.entity.ts
 */

// 确保 reflect-metadata 已导入（在 data-source.ts 中已导入，这里作为双重保险）
import 'reflect-metadata';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

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
   * 数据库存储格式：逗号分隔的字符串 'tag1,tag2,tag3'
   * 应用层格式：字符串数组 ['tag1', 'tag2', 'tag3']
   * 
   * 注意：不使用 TypeORM Transformer，在 Service 层手动处理转换
   * - 存储时：数组 → 字符串（createPost/updatePost）
   * - 读取时：字符串 → 数组（serializePost）
   */
  @Column('varchar', {
    name: 'tags',
    nullable: true,
    length: 255,
  })
  tags!: string | null;

  /**
   * 发布日期
   * TypeORM 会自动处理 Date ↔ MySQL datetime 转换
   * MySQL 5.7 datetime 格式：YYYY-MM-DD HH:MM:SS (不支持毫秒，TypeORM 会自动截断)
   */
  @Column('datetime', { name: 'date', nullable: true })
  date!: Date | null;

  /**
   * 更新时间
   * TypeORM 会自动处理 Date ↔ MySQL datetime 转换
   */
  @Column('datetime', { name: 'updated', nullable: true })
  updated!: Date | null;

  @Column('varchar', { name: 'cover', nullable: true, length: 255 })
  cover!: string | null;

  @Column('varchar', { name: 'layout', nullable: true, length: 255 })
  layout!: string | null;

  @Column('text', { name: 'content', nullable: true })
  content!: string | null;

  @Column('varchar', { name: 'description', nullable: true, length: 500 })
  description?: string | null;

  @Column('int', { name: 'visitors', nullable: true, default: 0 })
  visitors?: number | null;

  @Column('int', { name: 'likes', nullable: true, default: 0 })
  likes?: number | null;

  @Column('varchar', { name: 'hide', nullable: true, default: '0' })
  hide?: string;

  @Column('int', { name: 'is_delete', nullable: false, default: 0 })
  is_delete?: number;
}

