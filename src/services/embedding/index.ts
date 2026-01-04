/**
 * 向量化服务统一导出
 * 提供文章向量化的完整流程
 */

import { splitMarkdownIntoChunks, type TextChunk } from './text-splitter';
import { embedTexts } from './embedding';
import {
  insertVectors,
  deleteVectorsByPostId,
  type VectorDataItem,
} from './vector-store';

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
}

/**
 * 文章向量化结果
 */
export interface EmbedPostResult {
  /** 成功插入的向量数量 */
  insertedCount: number;
  /** 生成的文本片段数量 */
  chunkCount: number;
}

/**
 * 将文章向量化并存储到 Qdrant
 * 
 * 流程：
 * 1. 将 Markdown 内容按语义切片
 * 2. 批量生成向量嵌入
 * 3. 删除该文章的旧向量数据（如果存在）
 * 4. 插入新的向量数据
 * 
 * @param params 文章向量化参数
 * @returns 向量化结果
 */
export async function embedPost(
  params: EmbedPostParams
): Promise<EmbedPostResult> {
  const { postId, title, content } = params;

  if (!content || content.trim().length === 0) {
    console.warn(`⚠️ 文章 ${postId} 内容为空，跳过向量化`);
    return {
      insertedCount: 0,
      chunkCount: 0,
    };
  }

  try {
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

    // 2. 批量生成向量嵌入
    console.log(`🔢 开始生成文章 ${postId} 的向量嵌入...`);
    const texts = chunks.map((chunk) => chunk.text);
    const embeddings = await embedTexts(texts);

    if (embeddings.length !== chunks.length) {
      throw new Error(
        `向量嵌入数量 (${embeddings.length}) 与文本片段数量 (${chunks.length}) 不匹配`
      );
    }

    console.log(`✅ 文章 ${postId} 向量嵌入生成完成`);

    // 3. 删除旧向量数据
    console.log(`🗑️ 删除文章 ${postId} 的旧向量数据...`);
    await deleteVectorsByPostId(postId);

    // 4. 准备向量数据
    const now = Date.now();
    const vectorItems: VectorDataItem[] = chunks.map((chunk, index) => ({
      postId,
      chunkIndex: chunk.index,
      chunkText: chunk.text,
      title,
      embedding: embeddings[index],
      createdAt: now,
    }));

    // 5. 插入新向量数据
    console.log(`💾 插入文章 ${postId} 的向量数据到 Qdrant...`);
    const insertedCount = await insertVectors(vectorItems);

    console.log(
      `✅ 文章 ${postId} 向量化完成：${insertedCount} 个向量已存储到 Qdrant`
    );

    return {
      insertedCount,
      chunkCount: chunks.length,
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
