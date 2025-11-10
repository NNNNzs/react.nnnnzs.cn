/**
 * TypeORM 数据源配置
 * 使用环境变量配置数据库连接
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { TbPost } from '@/entities/post.entity';
import { TbUser } from '@/entities/user.entity';

/**
 * 数据库配置
 */
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'system',
  synchronize: process.env.NODE_ENV === 'development', // 开发环境自动同步表结构
  logging: process.env.NODE_ENV === 'development',
  entities: [TbPost, TbUser],
  migrations: [],
  subscribers: [],
  charset: 'utf8mb4',
});


/**
 * 数据源实例（单例模式）
 */
let dataSourceInstance: DataSource | null = null;

/**
 * 获取数据源实例
 */
export async function getDataSource(): Promise<DataSource> {
  if (!dataSourceInstance) {
    dataSourceInstance = AppDataSource;
    
    if (!dataSourceInstance.isInitialized) {
      await dataSourceInstance.initialize();
      console.log('✅ 数据库连接成功');
    }
  }
  
  return dataSourceInstance;
}

/**
 * 关闭数据源连接
 */
export async function closeDataSource(): Promise<void> {
  if (dataSourceInstance && dataSourceInstance.isInitialized) {
    await dataSourceInstance.destroy();
    dataSourceInstance = null;
    console.log('✅ 数据库连接已关闭');
  }
}

