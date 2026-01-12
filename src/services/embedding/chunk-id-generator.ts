/**
 * Chunk ID 生成器
 * 生成稳定的 Chunk ID，确保内容未变时ID不变
 */

import { createHash } from 'crypto';

/**
 * 生成稳定的 Chunk ID（基于内容 hash）
 * 
 * 新策略：使用内容 hash 作为 ID 的核心，确保：
 * - 相同内容生成相同 ID
 * - 顺序变化不影响 ID
 * - 内容变化时 ID 自然变化
 * 
 * @param postId 文章ID
 * @param chunkType Chunk 类型，例如 "section" | "code" | "list" | "paragraph"
 * @param contentHash 内容的 hash 值
 * @returns 稳定的 Chunk ID
 */
export function generateStableChunkId(
  postId: number,
  chunkType: string,
  contentHash: string
): string {
  // 使用内容 hash 的前16位作为 ID，加上 postId 和类型前缀
  // 格式：chunk_{postId}_{type}_{contentHash前16位}
  return `chunk_${postId}_${chunkType}_${contentHash.substring(0, 16)}`;
}

/**
 * 生成稳定的 Chunk ID（旧版，基于路径）
 * 保留用于向后兼容
 * 
 * 规则：hash(postId + headingPath + chunkType)
 * 
 * @param postId 文章ID
 * @param headingPath 标题路径，例如 "#前言/##背景"
 * @param chunkType Chunk 类型，例如 "section" | "code" | "list" | "paragraph"
 * @returns 稳定的 Chunk ID
 * @deprecated 使用 generateStableChunkId 代替
 */
export function generateChunkId(
  postId: number,
  headingPath: string,
  chunkType: string
): string {
  const idString = `${postId}:${headingPath}:${chunkType}`;
  const hash = createHash('sha256').update(idString, 'utf8').digest('hex');
  // 使用前32位作为ID（足够唯一，且不会太长）
  return `chunk_${postId}_${hash.substring(0, 16)}`;
}

/**
 * 从标题路径构建 headingPath
 * 
 * @param headings 标题层级数组，例如 ["前言", "背景"]
 * @returns 标题路径字符串，例如 "#前言/##背景"
 */
export function buildHeadingPath(headings: string[]): string {
  if (!headings || headings.length === 0) {
    return '';
  }
  
  return headings
    .map((heading, index) => {
      const level = index + 1;
      const prefix = '#'.repeat(level);
      return `${prefix}${heading}`;
    })
    .join('/');
}
