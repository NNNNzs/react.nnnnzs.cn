/**
 * 配置实体
 * 对应数据库表 tb_config
 */

// 确保 reflect-metadata 已导入
import 'reflect-metadata';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tb_config', { schema: 'system' })
export class TbConfig {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id!: number;

  @Column('varchar', { name: 'title', nullable: true, length: 20 })
  title!: string | null;

  @Column('varchar', { name: 'key', nullable: true, length: 20 })
  key!: string | null;

  @Column('text', { name: 'value', nullable: true })
  value!: string | null;

  @Column('int', { name: 'status', nullable: true })
  status!: number | null;

  @Column('datetime', { name: 'created_at', nullable: true })
  created_at!: Date | null | string;

  @Column('datetime', { name: 'updated_at', nullable: true })
  updated_at!: Date | null | string;

  @Column('datetime', { name: 'last_read_at', nullable: true })
  last_read_at!: Date | null | string;

  @Column('text', { name: 'remark', nullable: true })
  remark!: string | null;
}
