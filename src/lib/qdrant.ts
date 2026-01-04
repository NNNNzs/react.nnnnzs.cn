/**
 * Qdrant 向量数据库连接库
 * 提供 Qdrant 客户端的单例和集合管理功能
 */

import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * 全局 Qdrant 实例类型声明
 */
declare global {
  var qdrant: QdrantClient | undefined;
}

/**
 * Qdrant 客户端配置
 */
const QDRANT_CONFIG = {
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY || undefined,
};

/**
 * Qdrant 集合配置
 */
export const QDRANT_COLLECTION_CONFIG = {
  /** 文章向量集合名称 */
  COLLECTION_NAME: 'post_vectors',
  /** 向量维度（BAAI/bge-large-zh-v1.5 的维度是 1024） */
  DIMENSION: 1024,
  /** 向量字段名 */
  VECTOR_FIELD: 'embedding',
  /** ID 字段名 */
  ID_FIELD: 'id',
  /** 文章ID字段名 */
  POST_ID_FIELD: 'post_id',
  /** 片段索引字段名 */
  CHUNK_INDEX_FIELD: 'chunk_index',
  /** 片段内容字段名 */
  CHUNK_TEXT_FIELD: 'chunk_text',
  /** 元数据字段 */
  METADATA_FIELDS: ['post_id', 'chunk_index', 'chunk_text', 'title', 'created_at'] as const,
};

/**
 * 获取 Qdrant 客户端实例（单例模式）
 */
export function getQdrantClient(): QdrantClient {
  if (global.qdrant) {
    return global.qdrant;
  }

  const clientConfig: {
    url: string;
    apiKey?: string;
    checkCompatibility?: boolean;
  } = {
    url: QDRANT_CONFIG.url,
    // 禁用版本兼容性检查
    checkCompatibility: false,
  };

  // 如果配置了 API key，则添加认证
  if (QDRANT_CONFIG.apiKey) {
    clientConfig.apiKey = QDRANT_CONFIG.apiKey;
  }

  const client = new QdrantClient(clientConfig);

  // 在开发环境中保存到全局变量，避免热重载时创建多个实例
  if (process.env.NODE_ENV !== 'production') {
    global.qdrant = client;
  }

  return client;
}

/**
 * 初始化 Qdrant 集合
 * 如果集合不存在则创建，如果存在则检查配置
 */
export async function initQdrantCollection(): Promise<void> {
  if (!process.env.QDRANT_URL) {
    throw new Error('QDRANT_URL 环境变量未设置');
  }

  const client = getQdrantClient();
  const { COLLECTION_NAME, DIMENSION } = QDRANT_COLLECTION_CONFIG;

  // 检查集合是否存在
  const collections = await client.getCollections();
  const collectionExists = collections.collections.some(
    (col) => col.name === COLLECTION_NAME
  );

  if (!collectionExists) {
    // 创建集合
    console.log(`📦 创建 Qdrant 集合: ${COLLECTION_NAME}`);

    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: DIMENSION,
        distance: 'Cosine', // 使用余弦相似度
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 1,
    });

    // 创建 payload 索引（用于快速过滤）
    try {
      await client.createPayloadIndex(COLLECTION_NAME, {
        field_name: QDRANT_COLLECTION_CONFIG.POST_ID_FIELD,
        field_schema: 'integer',
      });
      console.log(`🔍 创建 payload 索引: ${QDRANT_COLLECTION_CONFIG.POST_ID_FIELD}`);
    } catch (indexError) {
      // 索引可能已存在，忽略错误
      console.warn('⚠️ 创建 payload 索引失败（可能已存在）:', indexError);
    }

    console.log(`✅ Qdrant 集合初始化完成: ${COLLECTION_NAME}`);
  } else {
    console.log(`✅ Qdrant 集合已存在: ${COLLECTION_NAME}`);

    // 验证集合配置
    const collectionInfo = await client.getCollection(COLLECTION_NAME);
    const vectorsConfig = collectionInfo.config.params.vectors;
    
    // 检查是否是命名向量配置
    if (vectorsConfig && typeof vectorsConfig === 'object' && 'size' in vectorsConfig) {
      // 单一向量配置
      const vectorSize = vectorsConfig.size;
      if (vectorSize !== DIMENSION) {
        console.warn(
          `⚠️ 集合 ${COLLECTION_NAME} 的向量维度 (${vectorSize}) 与配置的维度 (${DIMENSION}) 不匹配`
        );
      }
    } else if (vectorsConfig && typeof vectorsConfig === 'object') {
      // 命名向量配置
      console.warn(
        `⚠️ 集合 ${COLLECTION_NAME} 使用了命名向量配置，但代码期望单一向量配置。这可能导致插入失败。`
      );
      console.warn('集合向量配置:', JSON.stringify(vectorsConfig, null, 2));
    } else {
      console.warn(
        `⚠️ 集合 ${COLLECTION_NAME} 的向量配置格式未知:`,
        JSON.stringify(vectorsConfig, null, 2)
      );
    }
  }
}

/**
 * 断开 Qdrant 连接
 */
export async function disconnectQdrant(): Promise<void> {
  if (global.qdrant) {
    // Qdrant REST 客户端不需要显式关闭连接
    global.qdrant = undefined;
    console.log('✅ Qdrant 连接已关闭');
  }
}
