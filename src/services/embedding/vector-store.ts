/**
 * 向量存储服务
 * 将向量数据存储到 Qdrant 向量数据库
 */

import { getQdrantClient, QDRANT_COLLECTION_CONFIG } from '@/lib/qdrant';

/**
 * 向量数据项
 */
export interface VectorDataItem {
  /** 文章ID */
  postId: number;
  /** 稳定的 Chunk ID（用于一致性标识） */
  chunkId?: string;
  /** 片段索引 */
  chunkIndex: number;
  /** 片段文本 */
  chunkText: string;
  /** 文章标题 */
  title: string;
  /** 是否隐藏（'0' 表示不隐藏，'1' 表示隐藏） */
  hide: string;
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
    
    const collectionDimension = collectionInfo.config.params.vectors?.size;


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
          [QDRANT_COLLECTION_CONFIG.HIDE_FIELD]: String(item.hide), // 确保是字符串类型
          created_at: Number(item.createdAt), // 确保是数字类型
          chunk_id: item.chunkId || String(pointId), // 保存 Chunk ID 用于删除
        },
      };
    });

    
    // 调试：输出第一条数据的示例
    if (points.length > 0) {
      void points[0];
    }

    // 批量插入数据（Qdrant 支持批量操作）
    // 注意：如果批量太大，可以分批插入
    const BATCH_SIZE = 100; // 每批最多 100 条
    let insertedCount = 0;

    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE);
      
      // 调试：输出要发送的数据格式（仅第一条）
      if (i === 0 && batch.length > 0) {
        void batch[0];
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


    return insertedCount;
  } catch (error) {
    // 输出详细的错误信息

    if (error instanceof Error) {
    }

    // 尝试提取 Qdrant 返回的详细错误信息
    try {
      // 检查是否是 HTTP 错误响应
      if (error && typeof error === 'object') {
        const errorObj = error as Record<string, unknown>;

        // 检查是否有 response 属性（Axios 错误格式）
        if ('response' in errorObj) {
          const response = errorObj.response as Record<string, unknown>;

          if (response.data) {
          }
        }

        // 检查是否有 data 属性（直接错误格式）
        if ('data' in errorObj && errorObj.data) {
        }

        // 输出所有可枚举属性
      }
    } catch {
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


    // Qdrant 的 delete 操作不返回删除数量，返回 1 表示操作成功
    return 1;
  } catch (error) {
    console.error(`❌ 删除文章 ${postId} 的向量数据失败:`, error);
    throw error;
  }
}

/**
 * 向量相似度搜索（带重试机制）
 *
 * @param queryVector 查询向量
 * @param limit 返回结果数量限制
 * @param filter 过滤条件（可选，Qdrant filter 格式，会与默认的 hide='0' 过滤条件合并）
 * @param maxRetries 最大重试次数，默认 2
 * @returns 搜索结果数组
 *
 * @remarks
 * ⚠️ 安全过滤：默认只搜索公开的文章（hide='0'）
 * - 必须匹配 hide='0'（公开文章）
 * - 排除 hide='1'（隐藏文章）
 * - 排除已删除文章（在应用层通过数据库查询过滤）
 */
export async function searchSimilarVectors(
  queryVector: number[],
  limit: number = 10,
  filter?: unknown,
  maxRetries: number = 2
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
    HIDE_FIELD,
  } = QDRANT_COLLECTION_CONFIG;

  // ✅ 安全过滤：只搜索 hide='0' 的公开文章
  // 使用 must 确保 hide 字段必须等于 '0'
  const defaultHideFilter = {
    must: [
      {
        key: HIDE_FIELD,
        match: {
          value: '0',
        },
      },
    ],
  };

  let combinedFilter: {
    must?: Array<unknown>;
    must_not?: Array<unknown>;
  };

  if (filter && typeof filter === 'object') {
    // 如果提供了自定义 filter，合并过滤条件
    const customFilter = filter as { must?: Array<unknown>; must_not?: Array<unknown> };
    combinedFilter = {
      must: [
        ...(defaultHideFilter.must || []),  // ✅ 始终要求 hide='0'
        ...(customFilter.must || []),
      ],
      must_not: customFilter.must_not || [],
    };
  } else {
    // 只使用默认的 hide 过滤条件
    combinedFilter = {
      must: defaultHideFilter.must,
    };
  }

  let lastError: Error | unknown;
  
  // 重试逻辑
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // 指数退避：第 1 次重试等待 1 秒，第 2 次等待 2 秒
        const delay = attempt * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const searchResult = await client.search(COLLECTION_NAME, {
        vector: queryVector,
        limit: limit,
        filter: combinedFilter,
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
      lastError = error;
      
      // 检查是否是连接超时或网络错误
      const isNetworkError = 
        error instanceof Error && (
          error.message.includes('timeout') ||
          error.message.includes('TIMEOUT') ||
          error.message.includes('fetch failed') ||
          error.message.includes('Connect Timeout') ||
          error.message.includes('UND_ERR_CONNECT_TIMEOUT')
        );

      // 如果是网络错误且还有重试机会，继续重试
      if (isNetworkError && attempt < maxRetries) {
        continue;
      }

      // 如果不是网络错误，或者已经重试完，直接抛出错误
      throw error;
    }
  }

  // 所有重试都失败，抛出最后一次的错误
  throw lastError || new Error('向量搜索失败：未知错误');
}

/**
 * 根据 Chunk ID 列表删除向量数据
 * 
 * @param chunkIds Chunk ID 列表（与 embedding_id 对应）
 * @returns 删除成功的数量
 */
export async function deleteVectorsByChunkIds(chunkIds: string[]): Promise<number> {
  if (!chunkIds || chunkIds.length === 0) {
    return 0;
  }

  const client = getQdrantClient();
  const { COLLECTION_NAME } = QDRANT_COLLECTION_CONFIG;

  try {
    // 将 chunkId 转换为数字 ID（如果是旧格式的数字 ID）
    // 新格式的 chunkId 是字符串，需要通过 payload 过滤删除
    const numericIds: number[] = [];
    const stringIds: string[] = [];

    for (const id of chunkIds) {
      const numId = parseInt(id, 10);
      if (!isNaN(numId) && String(numId) === id) {
        numericIds.push(numId);
      } else {
        stringIds.push(id);
      }
    }

    let deletedCount = 0;

    // 删除数字 ID 的向量（旧格式）
    if (numericIds.length > 0) {
      await client.delete(COLLECTION_NAME, {
        wait: true,
        points: numericIds,
      });
      deletedCount += numericIds.length;
    }

    // 删除字符串 ID 的向量（新格式，通过 chunk_id payload 过滤）
    if (stringIds.length > 0) {
      // Qdrant 不支持批量按 payload 删除，需要逐个删除
      // 或者使用 filter 条件删除
      await client.delete(COLLECTION_NAME, {
        wait: true,
        filter: {
          should: stringIds.map((id) => ({
            key: 'chunk_id',
            match: { value: id },
          })),
        },
      });
      deletedCount += stringIds.length;
    }

    return deletedCount;
  } catch (error) {
    throw error;
  }
}
