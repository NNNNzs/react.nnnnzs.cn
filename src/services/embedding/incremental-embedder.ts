/**
 * 增量向量化服务
 * 实现基于 Chunk Hash 的增量向量化，仅对变更的 Chunks 进行向量化
 */

import { getPrisma } from '@/lib/prisma';
import { splitMarkdownByHeadings, splitMarkdownIntoChunks } from './text-splitter';
import { normalizeContent, hashContent } from './chunk-normalizer';
import { generateStableChunkId } from './chunk-id-generator';
import { embedTexts } from './embedding';
import {
  insertVectors,
  deleteVectorsByChunkIds,
  type VectorDataItem,
} from './vector-store';
import type { TextChunk } from './text-splitter';

/**
 * Chunk 数据
 */
export interface ChunkData {
  id: string; // 稳定 Chunk ID（基于内容 hash）
  type: string; // section | code | list | paragraph
  content: string; // 原始内容
  normalizedContent: string; // 规范化后的内容
  hash: string; // 内容 hash
  headingPath: string; // 标题路径（保留用于兼容，但不再用于 ID 生成）
  chunkIndex?: number; // 分块索引（用于向量存储）
  chunk: TextChunk; // 文本分块信息
  embeddingId?: string | null; // 向量ID（可选，用于从数据库加载时）
}

/**
 * 增量向量化参数
 */
export interface IncrementalEmbedParams {
  /** 文章ID */
  postId: number;
  /** 文章标题 */
  title: string;
  /** 文章内容（Markdown 格式） */
  content: string;
  /** 版本号 */
  version: number;
  /** 是否隐藏 */
  hide?: string;
}

/**
 * 增量向量化结果
 */
export interface IncrementalEmbedResult {
  /** 成功插入/更新的向量数量 */
  insertedCount: number;
  /** 生成的文本片段数量 */
  chunkCount: number;
  /** 需要向量化的 Chunk 数量 */
  changedChunkCount: number;
  /** 复用的 Chunk 数量 */
  reusedChunkCount: number;
}

/**
 * 加载上一版本的 Chunks
 * 
 * @param postId 文章ID
 * @param currentVersion 当前版本号
 * @returns 上一版本的 Chunks Map（key: chunk_id, value: ChunkData）
 */
async function loadPreviousChunks(
  postId: number,
  currentVersion: number
): Promise<Map<string, ChunkData>> {
  const prisma = await getPrisma();

  // 查找上一个版本号
  const previousVersion = await prisma.tbPostChunk.findFirst({
    where: {
      post_id: postId,
      version: { lt: currentVersion },
    },
    orderBy: {
      version: 'desc',
    },
    select: {
      version: true,
    },
  });

  if (!previousVersion) {
    return new Map();
  }

  // 加载上一个版本的所有 Chunks
  const chunks = await prisma.tbPostChunk.findMany({
    where: {
      post_id: postId,
      version: previousVersion.version,
    },
  });

  const chunksMap = new Map<string, ChunkData>();
  for (const chunk of chunks) {
    chunksMap.set(chunk.id, {
      id: chunk.id,
      type: chunk.type,
      content: chunk.content,
      normalizedContent: normalizeContent(chunk.content),
      hash: chunk.hash,
      headingPath: '', // 从数据库恢复时不需要使用
      embeddingId: chunk.embedding_id, // 正确加载 embedding_id
      chunk: {
        text: chunk.content,
        index: 0, // 索引在比较时不需要
        startIndex: 0,
        endIndex: chunk.content.length,
      },
    });
  }

  return chunksMap;
}

/**
 * 解析 Markdown 为 Chunks（基于标题分块）
 * 使用内容 hash 生成稳定的 Chunk ID，避免顺序变化导致 ID 变化
 * 
 * @param postId 文章ID
 * @param content 文章内容
 * @returns Chunk 数据数组
 */
function parseMarkdownToChunks(
  postId: number,
  content: string
): ChunkData[] {
  const chunksData: ChunkData[] = [];
  
  // 尝试使用基于标题的分块
  const headingChunks = splitMarkdownByHeadings(content, {
    chunkSize: 500,
    chunkOverlap: 100,
    minChunkSize: 100,
  });

  // 如果有标题分块，使用它
  if (headingChunks.length > 0) {
    headingChunks.forEach((chunk, index) => {
      const normalizedContent = normalizeContent(chunk.text);
      const hash = hashContent(normalizedContent);
      // 使用内容 hash 生成稳定的 Chunk ID，而不是使用 index
      const chunkId = generateStableChunkId(postId, 'section', hash);

      chunksData.push({
        id: chunkId,
        type: 'section',
        content: chunk.text,
        normalizedContent: normalizedContent,
        hash: hash,
        headingPath: '', // 不再使用 headingPath
        chunkIndex: index, // 保留原始索引用于向量存储
        chunk: chunk,
      });
    });
  } else {
    // 回退到普通文本分块
    const chunks = splitMarkdownIntoChunks(content, {
      chunkSize: 500,
      chunkOverlap: 100,
      minChunkSize: 100,
    });

    chunks.forEach((chunk, index) => {
      const normalizedContent = normalizeContent(chunk.text);
      const hash = hashContent(normalizedContent);
      // 使用内容 hash 生成稳定的 Chunk ID
      const chunkId = generateStableChunkId(postId, 'paragraph', hash);

      chunksData.push({
        id: chunkId,
        type: 'paragraph',
        content: chunk.text,
        normalizedContent: normalizedContent,
        hash: hash,
        headingPath: '', // 不再使用 headingPath
        chunkIndex: index, // 保留原始索引用于向量存储
        chunk: chunk,
      });
    });
  }

  return chunksData;
}

/**
 * 增量向量化文章
 * 
 * @param params 增量向量化参数
 * @returns 向量化结果
 */
export async function incrementalEmbedPost(
  params: IncrementalEmbedParams
): Promise<IncrementalEmbedResult> {
  const { postId, title, content, version, hide = '0' } = params;

  if (!content || content.trim().length === 0) {
    console.warn(`⚠️ 文章 ${postId} 内容为空，跳过向量化`);
    return {
      insertedCount: 0,
      chunkCount: 0,
      changedChunkCount: 0,
      reusedChunkCount: 0,
    };
  }

  try {
    // 1. 解析 Markdown 为 Chunks
    const currentChunks = parseMarkdownToChunks(postId, content);

    if (currentChunks.length === 0) {
      console.warn(`⚠️ 文章 ${postId} 版本 ${version} 解析后为空，跳过向量化`);
      return {
        insertedCount: 0,
        chunkCount: 0,
        changedChunkCount: 0,
        reusedChunkCount: 0,
      };
    }

    // 2. 加载上一版本的 Chunks
    const previousChunksMap = await loadPreviousChunks(postId, version);

    // 3. 对比 Hash，识别变更
    const changedChunks: ChunkData[] = [];
    const unchangedChunkIds: string[] = [];
    const newChunkIds = new Set(currentChunks.map((c) => c.id));

    for (const currentChunk of currentChunks) {
      const previousChunk = previousChunksMap.get(currentChunk.id);

      if (!previousChunk) {
        // 新 Chunk
        changedChunks.push(currentChunk);
      } else if (previousChunk.hash !== currentChunk.hash) {
        // Hash 变更，内容已修改
        changedChunks.push(currentChunk);
      } else {
        // Hash 相同，内容未变更，复用
        unchangedChunkIds.push(currentChunk.id);
      }
    }

    // 识别已删除的 Chunks
    const deletedChunkIds: string[] = [];
    for (const [chunkId] of previousChunksMap) {
      if (!newChunkIds.has(chunkId)) {
        deletedChunkIds.push(chunkId);
      }
    }

    // 4. 仅对变更的 Chunks 调用 embedding 模型
    let embeddings: number[][] = [];
    if (changedChunks.length > 0) {
      const texts = changedChunks.map((c) => c.normalizedContent);
      embeddings = await embedTexts(texts);
    }

    // 5. 保存 Chunks 到数据库
    const prisma = await getPrisma();

    // 删除已移除的 Chunks（同时从数据库和向量库删除）
    if (deletedChunkIds.length > 0) {
      // 获取要删除的 Chunks 的 embedding_id
      const deletedChunks = await prisma.tbPostChunk.findMany({
        where: {
          post_id: postId,
          id: { in: deletedChunkIds },
        },
        select: {
          embedding_id: true,
        },
      });

      // 从向量库删除
      const embeddingIdsToDelete = deletedChunks
        .map((c) => c.embedding_id)
        .filter((id): id is string => id !== null);

      if (embeddingIdsToDelete.length > 0) {
        try {
          await deleteVectorsByChunkIds(embeddingIdsToDelete);
        } catch (error) {
          console.error(`❌ 从向量库删除向量失败:`, error);
          // 向量删除失败不影响后续流程
        }
      }

      // 从数据库删除
      await prisma.tbPostChunk.deleteMany({
        where: {
          post_id: postId,
          id: { in: deletedChunkIds },
        },
      });
    }

    // 准备chunk数据，包括从上一版本复用的embedding_id
    const chunkDataToInsert = currentChunks.map((chunk) => {
      const previousChunk = previousChunksMap.get(chunk.id);
      // 如果是复用的chunk，保留上一版本的embedding_id
      const embeddingId = unchangedChunkIds.includes(chunk.id) && previousChunk
        ? previousChunk.embeddingId || null
        : null; // 新chunk或变更chunk的embedding_id将在向量存储后更新

      return {
        id: chunk.id,
        post_id: postId,
        version: version,
        type: chunk.type,
        content: chunk.content,
        hash: chunk.hash,
        embedding_id: embeddingId,
      };
    });

    // 保存当前版本的 Chunks
    await prisma.tbPostChunk.createMany({
      data: chunkDataToInsert,
      skipDuplicates: true,
    });

    // 6. 准备向量数据（仅包含变更的 Chunks）
    const now = Date.now();
    const vectorItems: VectorDataItem[] = changedChunks.map((chunk, index) => ({
      postId,
      chunkId: chunk.id, // 使用稳定的 Chunk ID
      chunkIndex: chunk.chunkIndex ?? chunk.chunk.index, // 使用保存的索引
      chunkText: chunk.normalizedContent,
      title,
      hide,
      embedding: embeddings[index],
      createdAt: now,
    }));

    // 7. 向量库 upsert（仅更新变更的 Chunks）
    let insertedCount = 0;
    if (vectorItems.length > 0) {
      insertedCount = await insertVectors(vectorItems);
    }

    // 8. 更新变更 chunks 的 embedding_id
    // 使用稳定的 Chunk ID 作为 embedding_id
    if (changedChunks.length > 0) {
      for (const chunk of changedChunks) {
        // 使用 chunk.id 作为 embedding_id，保持一致性
        await prisma.tbPostChunk.updateMany({
          where: {
            id: chunk.id,
            post_id: postId,
            version: version,
          },
          data: {
            embedding_id: chunk.id, // 使用 Chunk ID 作为 embedding_id
          },
        });
      }
    }

    return {
      insertedCount,
      chunkCount: currentChunks.length,
      changedChunkCount: changedChunks.length,
      reusedChunkCount: unchangedChunkIds.length,
    };
  } catch (error) {
    console.error(`❌ 文章 ${postId} 版本 ${version} 增量向量化失败:`, error);
    throw error;
  }
}
