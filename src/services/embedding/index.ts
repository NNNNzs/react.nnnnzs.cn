/**
 * 向量化服务统一导出
 * 提供文章向量化的完整流程
 */

import { splitMarkdownIntoChunks } from './text-splitter';
import { embedTexts, embedText } from './embedding';
import {
  insertVectors,
  deleteVectorsByPostId,
  hasVectorsByPostId,
  type VectorDataItem,
} from './vector-store';

// 导出嵌入函数
export { embedTexts, embedText };

/**
 * 文章向量化参数
 */
export interface EmbedPostParams {
  /** 文章ID */
  postId: number;
  /** 文章标题 */
  title: string;
  /** 文章内容（Markdown 格式） */
  content: string;
  /** 是否强制更新（默认 false，如果已存在向量则跳过） */
  force?: boolean;
  /** 是否隐藏（'0' 表示不隐藏，'1' 表示隐藏，默认为 '0'） */
  hide?: string;
}

/**
 * 文章向量化结果
 */
export interface EmbedPostResult {
  /** 成功插入的向量数量 */
  insertedCount: number;
  /** 生成的文本片段数量 */
  chunkCount: number;
  /** 是否因为已存在向量而跳过 */
  skipped?: boolean;
}

/**
 * 将文章向量化并存储到 Qdrant
 * 
 * 流程：
 * 1. 检查是否已存在向量（如果 force=false）
 * 2. 将 Markdown 内容按语义切片
 * 3. 批量生成向量嵌入
 * 4. 删除该文章的旧向量数据（如果存在且 force=true）
 * 5. 插入新的向量数据
 * 
 * @param params 文章向量化参数
 * @returns 向量化结果
 */
export async function embedPost(
  params: EmbedPostParams
): Promise<EmbedPostResult> {
  const { postId, title, content, force = false, hide = '0' } = params;

  if (!content || content.trim().length === 0) {
    console.warn(`⚠️ 文章 ${postId} 内容为空，跳过向量化`);
    return {
      insertedCount: 0,
      chunkCount: 0,
    };
  }

  try {
    // 如果不是强制更新，先检查是否已存在向量
    if (!force) {
      const hasVectors = await hasVectorsByPostId(postId);
      if (hasVectors) {
        console.log(`⏭️ 文章 ${postId} 已存在向量数据，跳过向量化（使用 force=true 可强制更新）`);
        return {
          insertedCount: 0,
          chunkCount: 0,
          skipped: true,
        };
      }
    }

    // 1. 文本切片
    console.log(`📝 开始对文章 ${postId} 进行语义切片...`);
    const chunks = splitMarkdownIntoChunks(content, {
      chunkSize: 500,
      chunkOverlap: 100,
      minChunkSize: 100,
    });

    if (chunks.length === 0) {
      console.warn(`⚠️ 文章 ${postId} 切片后为空，跳过向量化`);
      return {
        insertedCount: 0,
        chunkCount: 0,
      };
    }

    console.log(`✅ 文章 ${postId} 切片完成，共 ${chunks.length} 个片段`);

    // 2. 过滤空文本并同步过滤 chunks，确保一一对应
    const validChunks: Array<{ chunk: typeof chunks[0]; index: number }> = [];
    chunks.forEach((chunk, originalIndex) => {
      if (chunk.text && chunk.text.trim().length > 0) {
        validChunks.push({ chunk, index: originalIndex });
      }
    });

    if (validChunks.length === 0) {
      console.warn(`⚠️ 文章 ${postId} 过滤空文本后无有效片段，跳过向量化`);
      return {
        insertedCount: 0,
        chunkCount: 0,
      };
    }

    // 3. 批量生成向量嵌入（只对有效文本生成）
    console.log(`🔢 开始生成文章 ${postId} 的向量嵌入...`);
    const texts = validChunks.map((item) => item.chunk.text);
    const embeddings = await embedTexts(texts);

    if (embeddings.length !== validChunks.length) {
      throw new Error(
        `向量嵌入数量 (${embeddings.length}) 与有效文本片段数量 (${validChunks.length}) 不匹配`
      );
    }

    console.log(`✅ 文章 ${postId} 向量嵌入生成完成`);

    // 4. 删除旧向量数据（只在需要更新时删除）
    if (force) {
      console.log(`🗑️ 删除文章 ${postId} 的旧向量数据...`);
      await deleteVectorsByPostId(postId);
    }

    // 5. 准备向量数据
    const now = Date.now();
    const vectorItems: VectorDataItem[] = validChunks.map((item, index) => ({
      postId,
      chunkIndex: item.chunk.index,
      chunkText: item.chunk.text,
      title,
      hide,
      embedding: embeddings[index],
      createdAt: now,
    }));

    // 6. 插入新向量数据
    console.log(`💾 插入文章 ${postId} 的向量数据到 Qdrant...`);
    const insertedCount = await insertVectors(vectorItems);

    console.log(
      `✅ 文章 ${postId} 向量化完成：${insertedCount} 个向量已存储到 Qdrant`
    );

    return {
      insertedCount,
      chunkCount: validChunks.length,
    };
  } catch (error) {
    console.error(`❌ 文章 ${postId} 向量化失败:`, error);
    throw error;
  }
}

/**
 * 删除文章的向量数据
 * 
 * @param postId 文章ID
 */
export async function removePostEmbeddings(postId: number): Promise<void> {
  try {
    await deleteVectorsByPostId(postId);
    console.log(`✅ 已删除文章 ${postId} 的向量数据`);
  } catch (error) {
    console.error(`❌ 删除文章 ${postId} 的向量数据失败:`, error);
    throw error;
  }
}

// 导出类型
export type { TextChunk } from './text-splitter';
export type { VectorDataItem } from './vector-store';

// 导出向量删除函数
export { deleteVectorsByChunkIds } from './vector-store';

// 导出简化的向量化服务
export { simpleEmbedPost } from './simple-embedder';
export type { SimpleEmbedParams, SimpleEmbedResult } from './simple-embedder';

// 导出异步队列系统
export {
  embeddingQueue,
  queueEmbedPost,
  queueEmbedPosts,
  getQueueStatus,
  EmbedStatus,
} from './embedding-queue';
export type { EmbedTask } from './embedding-queue';
