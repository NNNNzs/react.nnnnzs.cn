/**
 * 内容规范化工具
 * 在计算 hash 前对内容进行规范化，避免无效变更触发更新
 */

import crypto from 'crypto';
/**
 * 规范化文本内容
 * 
 * @param content 原始内容
 * @returns 规范化后的内容
 */
export function normalizeContent(content: string): string {
  if (!content) {
    return '';
  }

  return content
    // 去除首尾空白
    .trim()
    // 统一换行符（\r\n → \n）
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // 多个空行压缩为最多 2 个
    .replace(/\n{3,}/g, '\n\n')
    // 去除行尾空白
    .replace(/[ \t]+$/gm, '');
}

/**
 * 计算内容的 SHA256 hash
 * 
 * @param content 内容
 * @returns SHA256 hash 字符串
 */
export function hashContent(content: string): string {
  const normalized = normalizeContent(content);
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}
