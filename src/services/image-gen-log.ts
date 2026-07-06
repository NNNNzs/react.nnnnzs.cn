/**
 * 图片生成日志服务
 *
 * 薄封装层，内部调用通用 ai-job-log.ts。
 * 保持原有 API 向后兼容。
 */

import {
  createAiJobLog,
  getAiJobLogs,
  getAiJobLogById,
  deleteAiJobLog,
  batchDeleteAiJobLogs,
  type AiJobSource,
  type AiJobStatus,
} from '@/services/ai-job-log';

// 类型别名，保持向后兼容
export type ImageGenSource = AiJobSource;
export type ImageGenStatus = AiJobStatus;

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
  // 构造 ext_json
  const extJson: Record<string, unknown> = {};
  if (params.editImageUrl) extJson.edit_image_url = params.editImageUrl;
  if (params.size) extJson.size = params.size;
  if (params.quality) extJson.quality = params.quality;
  extJson.mode = params.editImageUrl ? 'edit' : 'generate';

  return createAiJobLog({
    type: 'image-gen',
    userId: params.userId,
    jobId: params.jobId,
    source: params.source,
    prompt: params.prompt,
    model: params.model,
    originalUrl: params.originalUrl,
    cdnUrl: params.cdnUrl,
    reservedCdnUrl: params.reservedCdnUrl,
    cosKey: params.cosKey,
    status: params.status,
    errorMessage: params.errorMessage,
    durationMs: params.durationMs,
    extText: params.editPrompt,
    extJson: Object.keys(extJson).length > 0 ? JSON.stringify(extJson) : null,
    startedAt: params.startedAt,
    finishedAt: params.finishedAt,
  });
}

/**
 * 查询图片生成日志（分页）
 */
export async function getImageGenLogs(query: ImageGenLogQuery) {
  return getAiJobLogs({
    type: 'image-gen',
    pageNum: query.pageNum,
    pageSize: query.pageSize,
    source: query.source,
    status: query.status,
    userId: query.userId,
  });
}

/**
 * 根据 ID 获取图片生成日志
 */
export async function getImageGenLogById(id: number) {
  return getAiJobLogById(id, 'image-gen');
}

/**
 * 删除图片生成日志，可选择同时删除 COS 文件
 */
export async function deleteImageGenLog(
  id: number,
  options: { deleteCos?: boolean } = {},
) {
  return deleteAiJobLog(id, { ...options, type: 'image-gen' });
}

/**
 * 批量删除图片生成日志，可选择同时删除 COS 文件
 */
export async function batchDeleteImageGenLogs(
  ids: number[],
  options: { deleteCos?: boolean } = {},
) {
  return batchDeleteAiJobLogs(ids, { ...options, type: 'image-gen' });
}
