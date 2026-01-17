/**
 * 简化的全量向量化服务
 * 移除增量更新逻辑，每次全量重新生成向量
 * 用于异步队列系统
 */

import { deleteVectorsByPostId, insertVectors, type VectorDataItem } from './vector-store';
import { splitMarkdownIntoChunks } from './text-splitter';
import { embedTexts } from './embedding';

export interface SimpleEmbedParams {
  postId: number;
  title: string;
  content: string;
  hide?: string;
}

export interface SimpleEmbedResult {
  insertedCount: number;
  chunkCount: number;
}

/**
 * 全量向量化文章（同步执行）
 *
 * 流程：
 * 1. 删除旧向量
 * 2. 文本切片
 * 3. 批量生成向量
 * 4. 插入新向量
 */
export async function simpleEmbedPost(
  params: SimpleEmbedParams
): Promise<SimpleEmbedResult> {
  const { postId, title, content, hide = '0' } = params;

  if (!content || content.trim().length === 0) {
    console.warn(`⚠️ 文章 ${postId} 内容为空，跳过向量化`);
    return { insertedCount: 0, chunkCount: 0 };
  }

  try {
    console.log(`🔄 开始向量化文章 ${postId}...`);

    // 1. 删除旧向量
    await deleteVectorsByPostId(postId);

    // 2. 文本切片（使用修复后的 text-splitter）
    const chunks = splitMarkdownIntoChunks(content, {
      chunkSize: 500,
      chunkOverlap: 100,
      minChunkSize: 100,
    });

    if (chunks.length === 0) {
      console.warn(`⚠️ 文章 ${postId} 切片后为空`);
      return { insertedCount: 0, chunkCount: 0 };
    }

    console.log(`✅ 文章 ${postId} 切片完成，共 ${chunks.length} 个片段`);

    // 3. 批量生成向量
    const texts = chunks.map((c) => c.text);
    const embeddings = await embedTexts(texts);

    // 4. 准备向量数据
    const vectorItems: VectorDataItem[] = chunks.map((chunk, index) => ({
      postId,
      chunkIndex: index,
      chunkText: chunk.text,  // 保留完整内容（不过度清理）
      title,
      hide,
      embedding: embeddings[index],
      createdAt: Date.now(),
    }));

    // 5. 插入向量
    const insertedCount = await insertVectors(vectorItems);

    console.log(`✅ 文章 ${postId} 向量化成功: ${insertedCount} 个向量`);

    return {
      insertedCount,
      chunkCount: chunks.length,
    };
  } catch (error) {
    console.error(`❌ 文章 ${postId} 向量化失败:`, error);
    throw error;
  }
}
