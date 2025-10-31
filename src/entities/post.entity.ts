/**
 * 文章实体
 * 参考 api.nnnnzs.cn/src/post/entities/post.entity.ts
 */

import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tb_post', { schema: 'system' })
export class TbPost {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id!: number;

  @Column('varchar', { name: 'path', nullable: true, length: 255 })
  path!: string | null;

  @Column('varchar', { name: 'title', nullable: true, length: 255 })
  title!: string | null;

  @Column('varchar', { name: 'oldTitle', nullable: true, length: 255 })
  oldTitle?: string | null;

  @Column('varchar', { name: 'category', nullable: true, length: 255 })
  category!: string | null;

  @Column('varchar', { name: 'tags', nullable: true, length: 255 })
  tags!: string | null;

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

