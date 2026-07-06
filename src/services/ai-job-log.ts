/**
 * 通用 AI 任务日志服务
 *
 * 替代各场景独立的日志表（如 image-gen-log.ts），统一操作 tb_ai_job 表。
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma-client/client';

/**
 * 任务类型枚举
 */
export type AiJobType = 'image-gen' | 'tts' | 'text-gen';

/**
 * 任务来源枚举
 */
export type AiJobSource = 'ADMIN' | 'MCP';

/**
 * 任务状态枚举
 */
export type AiJobStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

/**
 * 创建任务日志参数
 */
export interface CreateAiJobLogParams {
  type: AiJobType;
  userId: number;
  jobId?: string;
  source: AiJobSource;
  prompt: string;
  model?: string | null;
  originalUrl?: string | null;
  cdnUrl?: string;
  reservedCdnUrl?: string;
  cosKey?: string;
  status: AiJobStatus;
  errorMessage?: string;
  durationMs: number;
  extText?: string | null;
  extJson?: string | null;
  startedAt?: Date;
  finishedAt?: Date;
}

/**
 * 查询任务日志参数
 */
export interface AiJobLogQuery {
  type?: AiJobType;
  pageNum?: number;
  pageSize?: number;
  source?: AiJobSource;
  status?: AiJobStatus;
  userId?: number;
}

/**
 * 创建任务日志
 */
export async function createAiJobLog(params: CreateAiJobLogParams) {
  return prisma.tbAiJob.create({
    data: {
      job_id: params.jobId,
      type: params.type,
      user_id: params.userId,
      source: params.source,
      prompt: params.prompt,
      model: params.model,
      original_url: params.originalUrl,
      cdn_url: params.cdnUrl,
      reserved_cdn_url: params.reservedCdnUrl,
      cos_key: params.cosKey,
      status: params.status,
      error_message: params.errorMessage,
      duration_ms: params.durationMs,
      ext_text: params.extText,
      ext_json: params.extJson,
      started_at: params.startedAt,
      finished_at: params.finishedAt,
    },
  });
}

/**
 * 查询任务日志（分页）
 */
export async function getAiJobLogs(query: AiJobLogQuery) {
  const pageNum = query.pageNum ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where: Prisma.TbAiJobWhereInput = {};
  if (query.type) where.type = query.type;
  if (query.source) where.source = query.source;
  if (query.status) where.status = query.status;
  if (query.userId) where.user_id = query.userId;

  const [total, records] = await Promise.all([
    prisma.tbAiJob.count({ where }),
    prisma.tbAiJob.findMany({
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
 * 根据 ID 获取任务日志
 */
export async function getAiJobLogById(id: number, type?: AiJobType) {
  if (!type) {
    return prisma.tbAiJob.findUnique({ where: { id } });
  }

  return prisma.tbAiJob.findFirst({
    where: { id, type },
  });
}

/**
 * 根据 job_id 获取任务日志
 */
export async function getAiJobLogByJobId(jobId: string) {
  return prisma.tbAiJob.findUnique({ where: { job_id: jobId } });
}

/**
 * 删除任务日志，可选择同时删除 COS 文件
 */
export async function deleteAiJobLog(
  id: number,
  options: { deleteCos?: boolean; type?: AiJobType } = {},
) {
  const log = await getAiJobLogById(id, options.type);
  if (!log) {
    throw new Error('任务记录不存在');
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

  await prisma.tbAiJob.delete({ where: { id } });

  return {
    log,
    deletedCosUrls,
    failedCosUrls,
  };
}

/**
 * 批量删除任务日志，可选择同时删除 COS 文件
 */
export async function batchDeleteAiJobLogs(
  ids: number[],
  options: { deleteCos?: boolean; type?: AiJobType } = {},
) {
  const where: Prisma.TbAiJobWhereInput = {
    id: { in: ids },
    ...(options.type ? { type: options.type } : {}),
  };

  const logs = await prisma.tbAiJob.findMany({
    where,
  });

  const deletedCosUrls: string[] = [];
  const failedCosUrls: Array<{ url: string; error: string }> = [];

  if (options.deleteCos) {
    const { deleteCdnImage } = await import('./image-proxy');
    const urls = logs.flatMap((log) =>
      [log.cdn_url, log.reserved_cdn_url, log.original_url].filter(
        (url): url is string => Boolean(url && url.startsWith('http')),
      ),
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

  await prisma.tbAiJob.deleteMany({
    where,
  });

  return {
    deletedCount: logs.length,
    deletedCosUrls,
    failedCosUrls,
  };
}
