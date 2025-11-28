/**
 * TypeORM 数据源配置
 * 使用环境变量配置数据库连接
 */

// 必须在所有其他导入之前导入 reflect-metadata
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
let initializationPromise: Promise<DataSource> | null = null;

/**
 * 获取数据源实例
 * 使用 Promise 确保并发请求时只初始化一次
 */
export async function getDataSource(): Promise<DataSource> {
  // 如果已经初始化，直接返回
  if (dataSourceInstance && dataSourceInstance.isInitialized) {
    return dataSourceInstance;
  }

  // 如果正在初始化，等待初始化完成
  if (initializationPromise) {
    return initializationPromise;
  }

  // 开始初始化
  initializationPromise = (async () => {
    try {
      // 如果实例存在但未初始化，尝试重新初始化
      if (dataSourceInstance && !dataSourceInstance.isInitialized) {
        // 检查连接状态，如果已关闭则创建新实例
        try {
          await dataSourceInstance.initialize();
        } catch (initError) {
          // 如果初始化失败，创建新实例
          console.warn('⚠️ 数据源初始化失败，尝试创建新实例:', initError);
          dataSourceInstance = new DataSource(AppDataSource.options);
          await dataSourceInstance.initialize();
        }
      } else if (!dataSourceInstance) {
        dataSourceInstance = AppDataSource;
        await dataSourceInstance.initialize();
      }

      // 验证元数据是否已加载（通过尝试获取元数据来验证）
      try {
        const metadata = dataSourceInstance.getMetadata(TbPost);
        if (!metadata) {
          console.warn('⚠️ TbPost 元数据未找到');
        }
      } catch (metadataError) {
        console.error('❌ 无法获取 TbPost 元数据:', metadataError);
        // 如果元数据获取失败，可能需要重新初始化
        throw new Error('实体元数据未正确加载，请检查实体定义和 reflect-metadata 导入');
      }

      console.log('✅ 数据库连接成功');
      return dataSourceInstance;
    } catch (error) {
      // 初始化失败，清除 Promise 以便重试
      initializationPromise = null;
      console.error('❌ 数据库连接失败:', error);
      if (error instanceof Error) {
        console.error('错误详情:', error.message);
        if (process.env.NODE_ENV === 'development') {
          console.error('错误堆栈:', error.stack);
        }
      }
      throw error;
    }
  })();

  return initializationPromise;
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

