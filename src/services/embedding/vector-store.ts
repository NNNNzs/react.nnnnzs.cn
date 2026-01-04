/**
 * 向量存储服务
 * 将向量数据存储到 Qdrant 向量数据库
 */

import { getQdrantClient, QDRANT_COLLECTION_CONFIG } from '@/lib/qdrant';
import type { TextChunk } from './text-splitter';

/**
 * 向量数据项
 */
export interface VectorDataItem {
  /** 文章ID */
  postId: number;
  /** 片段索引 */
  chunkIndex: number;
  /** 片段文本 */
  chunkText: string;
  /** 文章标题 */
  title: string;
  /** 向量嵌入 */
  embedding: number[];
  /** 创建时间戳 */
  createdAt: number;
}

/**
 * 插入向量数据到 Qdrant
 * 
 * @param items 向量数据项数组
 * @returns 插入成功的数量
 */
export async function insertVectors(items: VectorDataItem[]): Promise<number> {
  if (!items || items.length === 0) {
    return 0;
  }

  const client = getQdrantClient();
  const { COLLECTION_NAME, DIMENSION } = QDRANT_COLLECTION_CONFIG;

  // 验证集合是否存在并检查配置
  try {
    const collectionInfo = await client.getCollection(COLLECTION_NAME);
    console.log('📊 集合信息:', JSON.stringify(collectionInfo, null, 2));
    
    const collectionDimension = collectionInfo.config.params.vectors?.size;
    const vectorConfig = collectionInfo.config.params.vectors;
    
    console.log('📐 集合向量配置:', {
      dimension: collectionDimension,
      distance: vectorConfig?.distance,
      configType: typeof vectorConfig,
      fullConfig: vectorConfig,
    });
    
    if (collectionDimension !== DIMENSION) {
      throw new Error(
        `集合向量维度 (${collectionDimension}) 与配置维度 (${DIMENSION}) 不匹配`
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not exist')) {
      throw new Error(`集合 ${COLLECTION_NAME} 不存在，请先初始化集合`);
    }
    throw error;
  }

  try {
    // 验证向量维度
    const expectedDimension = QDRANT_COLLECTION_CONFIG.DIMENSION;
    const firstEmbedding = items[0]?.embedding;
    if (firstEmbedding && firstEmbedding.length !== expectedDimension) {
      throw new Error(
        `向量维度不匹配：期望 ${expectedDimension}，实际 ${firstEmbedding.length}`
      );
    }

    // 准备 Qdrant 格式的数据点
    const points = items.map((item, index) => {
      // 验证向量维度
      if (item.embedding.length !== expectedDimension) {
        throw new Error(
          `第 ${index} 个向量的维度不匹配：期望 ${expectedDimension}，实际 ${item.embedding.length}`
        );
      }

      // 验证向量数据有效性
      const invalidValues = item.embedding.filter(
        (val) => !Number.isFinite(val) || isNaN(val)
      );
      if (invalidValues.length > 0) {
        throw new Error(
          `第 ${index} 个向量包含无效值（NaN 或 Infinity），共 ${invalidValues.length} 个`
        );
      }

      // 确保向量是普通数组，不是 TypedArray
      const vector = Array.from(item.embedding);

      // Qdrant 只接受无符号整数或 UUID 作为 ID
      // 使用 postId * 100000 + chunkIndex 生成唯一整数 ID
      // 假设 postId < 100000，chunkIndex < 100000，这样可以保证唯一性
      const pointId = item.postId * 100000 + item.chunkIndex;

      return {
        id: pointId, // 使用整数 ID（Qdrant 要求）
        vector: vector,
        payload: {
          [QDRANT_COLLECTION_CONFIG.POST_ID_FIELD]: Number(item.postId), // 确保是数字类型
          [QDRANT_COLLECTION_CONFIG.CHUNK_INDEX_FIELD]: Number(item.chunkIndex), // 确保是数字类型
          [QDRANT_COLLECTION_CONFIG.CHUNK_TEXT_FIELD]: String(item.chunkText),
          title: String(item.title),
          created_at: Number(item.createdAt), // 确保是数字类型
        },
      };
    });

    console.log(`📤 准备插入 ${points.length} 条向量数据，向量维度: ${expectedDimension}`);
    
    // 调试：输出第一条数据的示例
    if (points.length > 0) {
      const firstPoint = points[0];
      console.log('📋 第一条数据示例:', {
        id: firstPoint.id,
        idType: typeof firstPoint.id,
        vectorLength: firstPoint.vector.length,
        payload: firstPoint.payload,
      });
    }

    // 批量插入数据（Qdrant 支持批量操作）
    // 注意：如果批量太大，可以分批插入
    const BATCH_SIZE = 100; // 每批最多 100 条
    let insertedCount = 0;

    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE);
      console.log(`📦 插入第 ${Math.floor(i / BATCH_SIZE) + 1} 批，共 ${batch.length} 条数据...`);
      
      // 调试：输出要发送的数据格式（仅第一条）
      if (i === 0 && batch.length > 0) {
        const samplePoint = batch[0];
        console.log('📤 发送的数据示例:', {
          id: samplePoint.id,
          idType: typeof samplePoint.id,
          idValue: samplePoint.id,
          vectorLength: samplePoint.vector?.length,
          vectorType: Array.isArray(samplePoint.vector) ? 'array' : typeof samplePoint.vector,
          payload: samplePoint.payload,
          payloadKeys: Object.keys(samplePoint.payload || {}),
        });
      }
      
      try {
        await client.upsert(COLLECTION_NAME, {
          wait: true, // 等待操作完成
          points: batch,
        });
        
        insertedCount += batch.length;
      } catch (upsertError) {
        // 如果是第一批失败，输出更详细的信息
        if (i === 0) {
          console.error('❌ 第一批数据插入失败，数据内容:');
          console.error(JSON.stringify(batch, null, 2));
        }
        throw upsertError;
      }
    }

    console.log(`✅ 成功插入 ${insertedCount} 条向量数据到 Qdrant`);

    return insertedCount;
  } catch (error) {
    // 输出详细的错误信息
    console.error('❌ 插入向量数据失败');
    
    if (error instanceof Error) {
      console.error('错误消息:', error.message);
      console.error('错误名称:', error.name);
      if (error.stack) {
        console.error('错误堆栈:', error.stack);
      }
    }

    // 尝试提取 Qdrant 返回的详细错误信息
    try {
      // 检查是否是 HTTP 错误响应
      if (error && typeof error === 'object') {
        const errorObj = error as Record<string, unknown>;
        
        // 检查是否有 response 属性（Axios 错误格式）
        if ('response' in errorObj) {
          const response = errorObj.response as Record<string, unknown>;
          console.error('📡 HTTP 响应状态:', response.status);
          console.error('📡 HTTP 响应状态文本:', response.statusText);
          
          if (response.data) {
            console.error('📡 Qdrant 错误响应数据:');
            if (typeof response.data === 'string') {
              console.error(response.data);
            } else {
              console.error(JSON.stringify(response.data, null, 2));
            }
          }
        }
        
        // 检查是否有 data 属性（直接错误格式）
        if ('data' in errorObj && errorObj.data) {
          console.error('📡 错误数据:');
          if (typeof errorObj.data === 'string') {
            console.error(errorObj.data);
          } else {
            console.error(JSON.stringify(errorObj.data, null, 2));
          }
        }
        
        // 输出所有可枚举属性
        console.error('🔍 错误对象的所有属性:', Object.keys(errorObj));
        console.error('🔍 错误对象完整内容:', JSON.stringify(errorObj, null, 2));
      }
    } catch (logError) {
      console.error('⚠️ 无法解析错误信息:', logError);
      console.error('原始错误:', error);
    }

    throw error;
  }
}

/**
 * 检查文章是否已经向量化
 * 
 * @param postId 文章ID
 * @returns 如果存在向量数据返回 true，否则返回 false
 */
export async function hasVectorsByPostId(postId: number): Promise<boolean> {
  const client = getQdrantClient();
  const { COLLECTION_NAME, POST_ID_FIELD } = QDRANT_COLLECTION_CONFIG;

  try {
    // 使用 scroll 查询匹配的数据点（只查询一条即可）
    const result = await client.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: POST_ID_FIELD,
            match: {
              value: postId,
            },
          },
        ],
      },
      limit: 1,
      with_payload: true,
      with_vector: false,
    });

    // 如果返回了数据点，说明已存在向量
    return result.points.length > 0;
  } catch (error) {
    console.error(`❌ 检查文章 ${postId} 的向量数据失败:`, error);
    // 如果查询出错，为了安全起见返回 false，允许重新向量化
    return false;
  }
}

/**
 * 删除文章的所有向量数据
 * 
 * @param postId 文章ID
 * @returns 删除成功的数量
 */
export async function deleteVectorsByPostId(postId: number): Promise<number> {
  const client = getQdrantClient();
  const { COLLECTION_NAME, POST_ID_FIELD } = QDRANT_COLLECTION_CONFIG;

  try {
    // 使用 filter 删除匹配的数据点
    await client.delete(COLLECTION_NAME, {
      wait: true,
      filter: {
        must: [
          {
            key: POST_ID_FIELD,
            match: {
              value: postId,
            },
          },
        ],
      },
    });

    console.log(`✅ 成功删除文章 ${postId} 的向量数据`);

    // Qdrant 的 delete 操作不返回删除数量，返回 1 表示操作成功
    return 1;
  } catch (error) {
    console.error(`❌ 删除文章 ${postId} 的向量数据失败:`, error);
    throw error;
  }
}

/**
 * 向量相似度搜索
 * 
 * @param queryVector 查询向量
 * @param limit 返回结果数量限制
 * @param filter 过滤条件（可选，Qdrant filter 格式）
 * @returns 搜索结果数组
 */
export async function searchSimilarVectors(
  queryVector: number[],
  limit: number = 10,
  filter?: unknown
): Promise<Array<{
  postId: number;
  chunkIndex: number;
  chunkText: string;
  title: string;
  score: number;
}>> {
  const client = getQdrantClient();
  const {
    COLLECTION_NAME,
    POST_ID_FIELD,
    CHUNK_INDEX_FIELD,
    CHUNK_TEXT_FIELD,
  } = QDRANT_COLLECTION_CONFIG;

  try {
    const searchResult = await client.search(COLLECTION_NAME, {
      vector: queryVector,
      limit: limit,
      filter: filter as {
        must?: Array<{
          key: string;
          match: { value: unknown };
        }>;
      },
      with_payload: true,
      with_vector: false,
    });

    // 转换结果格式
    const results = searchResult.map((hit) => ({
      postId: Number(hit.payload?.[POST_ID_FIELD]),
      chunkIndex: Number(hit.payload?.[CHUNK_INDEX_FIELD]),
      chunkText: String(hit.payload?.[CHUNK_TEXT_FIELD] || ''),
      title: String(hit.payload?.title || ''),
      score: hit.score || 0,
    }));

    return results;
  } catch (error) {
    console.error('❌ 向量搜索失败:', error);
    throw error;
  }
}
