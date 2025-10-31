/**
 * 用户实体
 * 参考 api.nnnnzs.cn/src/user/entities/user.entity.ts
 */

import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tb_user', { schema: 'system' })
export class TbUser {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true })
  role!: string;

  @Column({ length: 16 })
  account!: string;

  @Column({ length: 255, nullable: true })
  avatar!: string;

  @Column({ length: 255, select: false })
  password!: string;

  @Column({ length: 16 })
  nickname!: string;

  @Column({ length: 30, nullable: true })
  mail!: string;

  @Column({ length: 11, nullable: true })
  phone!: string;

  @Column({ length: 16, nullable: true })
  registered_ip!: string;

  @Column({ nullable: true })
  registered_time!: Date;

  @Column({ length: 30, nullable: true })
  dd_id!: string;

  @Column({ nullable: true })
  github_id!: string;

  @Column({ length: 255, nullable: true })
  work_wechat_id!: string;

  @Column({ nullable: false, default: 1 })
  status!: number;
}

