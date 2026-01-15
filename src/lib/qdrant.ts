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
 * 解析 Qdrant URL，提取 host、port 和协议
 * 这样可以避免 Qdrant 客户端库在 URL 中使用标准端口时自动添加 6333 端口
 * 
 * @param url 原始 URL
 * @returns 解析后的配置对象
 */
function parseQdrantUrl(url: string): {
  host?: string;
  port?: number;
  https?: boolean;
  url?: string;
} {
  try {
    const urlObj = new URL(url);
    
    // 提取协议
    const isHttps = urlObj.protocol === 'https:';
    
    // 提取端口号
    // 注意：如果 URL 中没有显式端口，urlObj.port 为空字符串
    // 对于标准端口（80/443），即使 URL 中写了 :80，port 也可能是空字符串
    // 所以我们需要从 URL 字符串中手动提取端口，或者根据协议推断
    let port: number | undefined;
    
    // 尝试从 URL 字符串中提取端口（更可靠）
    const portMatch = url.match(/:(\d+)(?:\/|$)/);
    if (portMatch) {
      port = parseInt(portMatch[1], 10);
    } else {
      // 如果没有显式端口，根据协议使用标准端口
      port = isHttps ? 443 : 80;
    }
    
    return {
      host: urlObj.hostname,
      port: port,
      https: isHttps,
    };
  } catch (error) {
    // 如果 URL 格式无效，返回原 URL 让库自己处理
    console.warn('⚠️ QDRANT_URL 格式可能无效，将使用 url 参数:', url, error);
    return { url };
  }
}

/**
 * Qdrant 客户端配置
 */
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_CONFIG = {
  ...parseQdrantUrl(QDRANT_URL),
  apiKey: process.env.QDRANT_API_KEY || undefined,
  // 超时时间（毫秒），默认 30 秒，可通过环境变量 QDRANT_TIMEOUT 配置
  timeout: process.env.QDRANT_TIMEOUT 
    ? parseInt(process.env.QDRANT_TIMEOUT, 10) 
    : 30000,
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
  /** 隐藏字段名 */
  HIDE_FIELD: 'hide',
  /** 元数据字段 */
  METADATA_FIELDS: ['post_id', 'chunk_index', 'chunk_text', 'title', 'created_at', 'hide'] as const,
};

/**
 * 获取 Qdrant 客户端实例（单例模式）
 */
export function getQdrantClient(): QdrantClient {
  if (global.qdrant) {
    return global.qdrant;
  }

  // 优先使用 host + port 参数，避免库自动添加 6333 端口
  const clientConfig: {
    url?: string;
    host?: string;
    port?: number;
    https?: boolean;
    apiKey?: string;
    checkCompatibility?: boolean;
    timeout?: number;
  } = {
    // 禁用版本兼容性检查
    checkCompatibility: false,
    // 设置超时时间
    timeout: QDRANT_CONFIG.timeout,
  };

  // 如果解析出了 host 和 port，使用这些参数（更可靠）
  if (QDRANT_CONFIG.host && QDRANT_CONFIG.port !== undefined) {
    clientConfig.host = QDRANT_CONFIG.host;
    clientConfig.port = QDRANT_CONFIG.port;
    if (QDRANT_CONFIG.https !== undefined) {
      clientConfig.https = QDRANT_CONFIG.https;
    }
  } else if (QDRANT_CONFIG.url) {
    // 如果解析失败，回退到使用 url 参数
    clientConfig.url = QDRANT_CONFIG.url;
  } else {
    // 兜底：使用默认配置
    clientConfig.url = QDRANT_URL;
  }

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
    } catch (indexError) {
      // 索引可能已存在，忽略错误
      console.warn('⚠️ 创建 payload 索引失败（可能已存在）:', indexError);
    }

    // 为 hide 字段创建 payload 索引（keyword 类型，因为值是字符串 '0' 或 '1'）
    try {
      await client.createPayloadIndex(COLLECTION_NAME, {
        field_name: QDRANT_COLLECTION_CONFIG.HIDE_FIELD,
        field_schema: 'keyword',
      });
    } catch (indexError) {
      // 索引可能已存在，忽略错误
      console.warn('⚠️ 创建 payload 索引失败（可能已存在）:', indexError);
    }

  } else {

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
  }
}
