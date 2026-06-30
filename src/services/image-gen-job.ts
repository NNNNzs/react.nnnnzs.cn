/**
 * 图片生成异步任务服务
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';
import { USER_MANAGE } from '@/constants/permissions';
import { getCdnUrlForCosKey, normalizeCosKey } from '@/services/file-upload';
import {
  generateImage,
  type ImageGenOptions,
  uploadGeneratedImageToCDN,
  validateImageGenOptions,
} from '@/services/image-gen';
import { TaskQueue, type QueueTask } from '@/services/queue/task-queue';
import type { AuthUser } from '@/types/auth';
import type { ImageGenSource, ImageGenStatus } from '@/services/image-gen-log';
import type { TbImageGenLog } from '@/generated/prisma-client';

interface ImageGenerationTaskPayload {
  jobId: string;
}

type ImageGenerationQueueTask = QueueTask<'image-generation', ImageGenerationTaskPayload>;

interface CreateImageGenerationJobParams {
  options: ImageGenOptions;
  userId: number;
  source: ImageGenSource;
  priority?: number;
}

export interface ImageGenerationJobView {
  id: number;
  jobId: string;
  status: ImageGenStatus;
  ready: boolean;
  imageUrl: string | null;
  reservedCdnUrl: string | null;
  cdnUrl: string | null;
  cosKey: string | null;
  originalUrl: string | null;
  errorMessage: string | null;
  source: string;
  prompt: string;
  mode: 'generate' | 'edit';
  size: string | null;
  quality: string | null;
  model: string | null;
  elapsed: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  resourceUri: string;
  statusUrl: string;
}

function readQueueNumber(value: string | undefined, fallback: number, min: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

const IMAGE_QUEUE_CONFIG = {
  concurrency: readQueueNumber(process.env.IMAGE_GEN_QUEUE_CONCURRENCY, 1, 1),
  maxRetries: readQueueNumber(process.env.IMAGE_GEN_QUEUE_MAX_RETRIES, 0, 0),
  retryDelay: readQueueNumber(process.env.IMAGE_GEN_QUEUE_RETRY_DELAY, 5000, 0),
  checkInterval: readQueueNumber(process.env.IMAGE_GEN_QUEUE_CHECK_INTERVAL, 1000, 100),
};

function buildImageGenerationCosKey(jobId: string) {
  return normalizeCosKey(`/upload/image-gen/${jobId}.png`);
}

function formatElapsed(durationMs: number) {
  return durationMs > 0 ? `${(durationMs / 1000).toFixed(1)}s` : null;
}

function toIsoString(date: Date | null) {
  return date ? date.toISOString() : null;
}

function formatImageGenerationJob(log: TbImageGenLog | null): ImageGenerationJobView | null {
  if (!log || !log.job_id) return null;

  const status = log.status as ImageGenStatus;
  const imageUrl = status === 'SUCCESS'
    ? log.cdn_url || log.reserved_cdn_url || log.original_url || null
    : null;

  return {
    id: log.id,
    jobId: log.job_id,
    status,
    ready: status === 'SUCCESS',
    imageUrl,
    reservedCdnUrl: log.reserved_cdn_url,
    cdnUrl: log.cdn_url,
    cosKey: log.cos_key,
    originalUrl: log.original_url || null,
    errorMessage: log.error_message,
    source: log.source,
    prompt: log.prompt,
    mode: log.edit_image_url ? 'edit' : 'generate',
    size: log.size,
    quality: log.quality,
    model: log.model || null,
    elapsed: formatElapsed(log.duration_ms),
    createdAt: log.created_at.toISOString(),
    startedAt: toIsoString(log.started_at),
    finishedAt: toIsoString(log.finished_at),
    resourceUri: `blog://image-generation-jobs/${log.job_id}`,
    statusUrl: `/api/image-gen/jobs/${log.job_id}`,
  };
}

async function processImageGenerationJob(jobId: string) {
  const job = await prisma.tbImageGenLog.findUnique({
    where: { job_id: jobId },
  });

  if (!job) {
    throw new Error(`图片生成任务不存在: ${jobId}`);
  }

  if (job.status === 'SUCCESS') {
    return;
  }

  // 用条件更新抢占 PROCESSING 状态，防止重复入队导致并发执行
  const startedAt = new Date();
  const startTime = Date.now();

  const claimed = await prisma.tbImageGenLog.updateMany({
    where: { job_id: jobId, status: 'PENDING' },
    data: {
      status: 'PROCESSING',
      error_message: null,
      started_at: job.started_at || startedAt,
    },
  });

  if (claimed.count === 0) {
    // 已被别的 worker 抢走、正在处理或已完成
    console.log(`图片生成任务 ${jobId} 已被处理，跳过`);
    return;
  }

  const options: ImageGenOptions = {
    mode: job.edit_image_url ? 'edit' : 'generate',
    prompt: job.prompt,
    ...(job.edit_image_url ? { image: job.edit_image_url } : {}),
    ...(job.size ? { size: job.size } : {}),
    ...(job.quality ? { quality: job.quality } : {}),
  };

  try {
    const result = await generateImage(options);
    const cdnUrl = await uploadGeneratedImageToCDN(result, {
      key: job.cos_key || undefined,
    });
    const durationMs = Date.now() - startTime;

    await prisma.tbImageGenLog.update({
      where: { job_id: jobId },
      data: {
        status: 'SUCCESS',
        model: result.model,
        original_url: result.b64Json ? 'b64_json' : result.imageUrl,
        cdn_url: cdnUrl,
        reserved_cdn_url: cdnUrl,
        duration_ms: durationMs,
        error_message: null,
        finished_at: new Date(),
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : '图片生成失败';

    await prisma.tbImageGenLog.update({
      where: { job_id: jobId },
      data: {
        status: 'FAILED',
        error_message: errorMessage,
        duration_ms: durationMs,
        finished_at: new Date(),
      },
    });

    throw error;
  }
}

export const imageGenerationQueue = new TaskQueue<ImageGenerationQueueTask>(
  {
    name: 'image-generation',
    ...IMAGE_QUEUE_CONFIG,
  },
  {
    process: async (task) => {
      await processImageGenerationJob(task.payload.jobId);
    },
    onRetry: (task, error, nextAttempt) => {
      console.error(`图片生成任务 ${task.id} 准备重试第 ${nextAttempt} 次:`, error);
    },
  },
);

export async function createImageGenerationJob(params: CreateImageGenerationJobParams) {
  validateImageGenOptions(params.options);

  const jobId = uuidv4();
  const cosKey = buildImageGenerationCosKey(jobId);
  const reservedCdnUrl = getCdnUrlForCosKey(cosKey);

  const log = await prisma.tbImageGenLog.create({
    data: {
      job_id: jobId,
      user_id: params.userId,
      source: params.source,
      prompt: params.options.prompt,
      edit_prompt: params.options.mode === 'edit' ? params.options.prompt : undefined,
      edit_image_url: params.options.mode === 'edit' ? params.options.image : undefined,
      size: params.options.size,
      quality: params.options.quality,
      model: null,
      original_url: null,
      cdn_url: null,
      reserved_cdn_url: reservedCdnUrl,
      cos_key: cosKey,
      status: 'PENDING',
      error_message: null,
      duration_ms: 0,
    },
  });

  imageGenerationQueue.add({
    id: jobId,
    type: 'image-generation',
    payload: { jobId },
    title: params.options.prompt.slice(0, 60),
    priority: params.priority ?? 5,
    addTime: Date.now(),
  });

  const job = formatImageGenerationJob(log);
  if (!job) {
    throw new Error('图片生成任务创建失败');
  }

  return job;
}

export async function getImageGenerationJob(jobId: string, user?: AuthUser | null) {
  const log = await prisma.tbImageGenLog.findUnique({
    where: { job_id: jobId },
  });

  if (!log) return null;

  // 未鉴权时拒绝访问（防御性编程，正常不会走到这里）
  if (!user) return null;

  const canViewAll = user.permissions.includes(USER_MANAGE);
  if (!canViewAll && log.user_id !== user.id) {
    return null;
  }

  return formatImageGenerationJob(log);
}

export function getImageGenerationQueueStatus() {
  return imageGenerationQueue.getStatus();
}
