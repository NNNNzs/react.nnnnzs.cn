/**
 * 图片生成日志服务
 */

import { prisma } from '@/lib/prisma';

export type ImageGenSource = 'ADMIN' | 'MCP';
export type ImageGenStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface CreateImageGenLogParams {
  userId: number;
  jobId?: string;
  source: ImageGenSource;
  prompt: string;
  editPrompt?: string;
  editImageUrl?: string;
  size?: string;
  quality?: string;
  model?: string | null;
  originalUrl?: string | null;
  cdnUrl?: string;
  reservedCdnUrl?: string;
  cosKey?: string;
  status: ImageGenStatus;
  errorMessage?: string;
  durationMs: number;
  startedAt?: Date;
  finishedAt?: Date;
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
      job_id: params.jobId,
      user_id: params.userId,
      source: params.source,
      prompt: params.prompt,
      edit_prompt: params.editPrompt,
      edit_image_url: params.editImageUrl,
      size: params.size,
      quality: params.quality,
      model: params.model,
      original_url: params.originalUrl,
      cdn_url: params.cdnUrl,
      reserved_cdn_url: params.reservedCdnUrl,
      cos_key: params.cosKey,
      status: params.status,
      error_message: params.errorMessage,
      duration_ms: params.durationMs,
      started_at: params.startedAt,
      finished_at: params.finishedAt,
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

/**
 * 根据 ID 获取图片生成日志
 */
export async function getImageGenLogById(id: number) {
  return prisma.tbImageGenLog.findUnique({
    where: { id },
  });
}

/**
 * 删除图片生成日志，可选择同时删除 COS 文件
 */
export async function deleteImageGenLog(
  id: number,
  options: { deleteCos?: boolean } = {},
) {
  const log = await getImageGenLogById(id);
  if (!log) {
    throw new Error('图片生成记录不存在');
  }

  const deletedCosUrls: string[] = [];
  const failedCosUrls: Array<{ url: string; error: string }> = [];

  if (options.deleteCos) {
    const { deleteCdnImage } = await import('./image-proxy');
    const urls = [log.cdn_url, log.reserved_cdn_url, log.original_url]
      .filter((url): url is string => Boolean(url && url.startsWith('http')));

    for (const url of Array.from(new Set(urls))) {
      try {
        const deleted = await deleteCdnImage(url);
        if (deleted) {
          deletedCosUrls.push(url);
        }
      } catch (error) {
        failedCosUrls.push({
          url,
          error: error instanceof Error ? error.message : '删除 COS 文件失败',
        });
      }
    }
  }

  await prisma.tbImageGenLog.delete({
    where: { id },
  });

  return {
    log,
    deletedCosUrls,
    failedCosUrls,
  };
}

/**
 * 批量删除图片生成日志，可选择同时删除 COS 文件
 */
export async function batchDeleteImageGenLogs(
  ids: number[],
  options: { deleteCos?: boolean } = {},
) {
  const logs = await prisma.tbImageGenLog.findMany({
    where: { id: { in: ids } },
  });

  const deletedCosUrls: string[] = [];
  const failedCosUrls: Array<{ url: string; error: string }> = [];

  if (options.deleteCos) {
    const { deleteCdnImage } = await import('./image-proxy');
    const urls = logs.flatMap((log) =>
      [log.cdn_url, log.reserved_cdn_url, log.original_url].filter(
        (url): url is string => Boolean(url && url.startsWith('http'))
      )
    );

    for (const url of Array.from(new Set(urls))) {
      try {
        const deleted = await deleteCdnImage(url);
        if (deleted) deletedCosUrls.push(url);
      } catch (error) {
        failedCosUrls.push({
          url,
          error: error instanceof Error ? error.message : '删除 COS 文件失败',
        });
      }
    }
  }

  await prisma.tbImageGenLog.deleteMany({
    where: { id: { in: ids } },
  });

  return {
    deletedCount: logs.length,
    deletedCosUrls,
    failedCosUrls,
  };
}
