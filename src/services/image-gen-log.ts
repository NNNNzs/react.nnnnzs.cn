/**
 * 图片生成日志服务
 */

import { prisma } from '@/lib/prisma';

export type ImageGenSource = 'ADMIN' | 'MCP';
export type ImageGenStatus = 'SUCCESS' | 'FAILED';

export interface CreateImageGenLogParams {
  userId: number;
  source: ImageGenSource;
  prompt: string;
  editPrompt?: string;
  editImageUrl?: string;
  model: string;
  originalUrl: string;
  cdnUrl?: string;
  status: ImageGenStatus;
  errorMessage?: string;
  durationMs: number;
}

export interface ImageGenLogQuery {
  pageNum?: number;
  pageSize?: number;
  source?: ImageGenSource;
  status?: ImageGenStatus;
  userId?: number;
}

/**
 * 创建图片生成日志
 */
export async function createImageGenLog(params: CreateImageGenLogParams) {
  return prisma.tbImageGenLog.create({
    data: {
      user_id: params.userId,
      source: params.source,
      prompt: params.prompt,
      edit_prompt: params.editPrompt,
      edit_image_url: params.editImageUrl,
      model: params.model,
      original_url: params.originalUrl,
      cdn_url: params.cdnUrl,
      status: params.status,
      error_message: params.errorMessage,
      duration_ms: params.durationMs,
    },
  });
}

/**
 * 查询图片生成日志（分页）
 */
export async function getImageGenLogs(query: ImageGenLogQuery) {
  const pageNum = query.pageNum ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where: Record<string, unknown> = {};
  if (query.source) where.source = query.source;
  if (query.status) where.status = query.status;
  if (query.userId) where.user_id = query.userId;

  const [total, records] = await Promise.all([
    prisma.tbImageGenLog.count({ where }),
    prisma.tbImageGenLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    total,
    pageNum,
    pageSize,
    record: records,
  };
}
