/**
 * 图片生成异步任务服务
 */

import { prisma } from '@/lib/prisma';
import { isUuid, generateUuid } from '@/lib/uuid';
import { USER_MANAGE } from '@/constants/permissions';
import type { ImageGenOptions } from '@/services/image-gen';
import { TaskQueue, type QueueTask } from '@/services/queue/task-queue';
import type { AuthUser } from '@/types/auth';
import type { ImageGenSource, ImageGenStatus } from '@/services/image-gen-log';
import type { TbImageGenLog } from '@/generated/prisma-client/client';

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

interface ImageGenerationQueueLogSummary {
  id: number;
  jobId: string;
  prompt: string;
  source: string;
  status: ImageGenStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ImageGenerationRecoverySnapshot {
  recoveredAt: string;
  staleProcessingCount: number;
  requeuedPendingCount: number;
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

export interface ImageGenerationMonitorView {
  queue: ReturnType<typeof getImageGenerationQueueStatus>;
  counts: Record<ImageGenStatus, number>;
  queueTasks: ImageGenerationQueueLogSummary[];
  processingTasks: ImageGenerationQueueLogSummary[];
  recentFailedTasks: ImageGenerationQueueLogSummary[];
  staleRecovery: ImageGenerationRecoverySnapshot | null;
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

let lastRecoverySnapshot: ImageGenerationRecoverySnapshot | null = null;

/**
 * 校验 jobId 并生成对应的 COS Key。
 */
function normalizeImageGenerationCosKey(jobId: string) {
  if (!isUuid(jobId)) {
    throw new Error('无效的图片生成任务 ID');
  }

  return `/upload/image-gen/${jobId}.png`;
}

/**
 * 根据 COS Key 生成预分配的 CDN URL。
 */
function getReservedCdnUrlForCosKey(cosKey: string) {
  const CDN_URL = process.env.CDN_URL || process.env.COS_CDN_URL;
  if (!CDN_URL) {
    throw new Error('COS 配置缺失：CDN_URL');
  }

  return `${CDN_URL.replace(/\/+$/, '')}${cosKey}`;
}

function formatElapsed(durationMs: number) {
  return durationMs > 0 ? `${(durationMs / 1000).toFixed(1)}s` : null;
}

function toIsoString(date: Date | null) {
  return date ? date.toISOString() : null;
}

/**
 * 将图片生成日志记录格式化为对外任务视图。
 */
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
    originalUrl: log.original_url,
    errorMessage: log.error_message,
    source: log.source,
    prompt: log.prompt,
    mode: log.edit_image_url ? 'edit' : 'generate',
    size: log.size,
    quality: log.quality,
    model: log.model,
    elapsed: formatElapsed(log.duration_ms),
    createdAt: log.created_at.toISOString(),
    startedAt: toIsoString(log.started_at),
    finishedAt: toIsoString(log.finished_at),
    resourceUri: `blog://image-generation-jobs/${log.job_id}`,
    statusUrl: `/api/image-gen/jobs/${log.job_id}`,
  };
}

/**
 * 将日志记录格式化为队列监控摘要。
 */
function toQueueLogSummary(log: TbImageGenLog): ImageGenerationQueueLogSummary {
  return {
    id: log.id,
    jobId: log.job_id || '',
    prompt: log.prompt,
    source: log.source,
    status: log.status as ImageGenStatus,
    errorMessage: log.error_message,
    createdAt: log.created_at.toISOString(),
    updatedAt: toIsoString(log.updated_at),
    startedAt: toIsoString(log.started_at),
    finishedAt: toIsoString(log.finished_at),
  };
}

/**
 * 处理单个图片生成任务：抢占、调用模型、上传 CDN、回写状态。
 */
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
    console.log(`图片生成任务 ${jobId} 已被其他 worker 处理，跳过`);
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
    const { generateImage, uploadGeneratedImageToCDN } = await import('@/services/image-gen');
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
      console.error(`图片生成任务 ${task.id} 准备重试第 ${nextAttempt} 次`, error);
    },
  },
);

/**
 * 创建图片生成任务：预分配 UUID / COS Key / 预留 CDN URL，单次写入后入队。
 */
export async function createImageGenerationJob(params: CreateImageGenerationJobParams) {
  const { validateImageGenOptions } = await import('@/services/image-gen');
  validateImageGenOptions(params.options);

  const jobId = generateUuid();
  const cosKey = normalizeImageGenerationCosKey(jobId);
  const reservedCdnUrl = getReservedCdnUrlForCosKey(cosKey);

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

/**
 * 查询图片生成任务状态（带归属校验，未鉴权或越权访问返回 null）。
 */
export async function getImageGenerationJob(jobId: string, user?: AuthUser | null) {
  const log = await prisma.tbImageGenLog.findUnique({
    where: { job_id: jobId },
  });

  if (!log) return null;
  if (!user) return null;

  const canViewAll = user.permissions.includes(USER_MANAGE);
  if (!canViewAll && log.user_id !== user.id) {
    return null;
  }

  return formatImageGenerationJob(log);
}

/**
 * 获取图片生成内存队列状态快照。
 */
export function getImageGenerationQueueStatus() {
  return imageGenerationQueue.getStatus();
}

/**
 * 设置启动时的 stale 任务恢复快照。
 */
export function setImageGenerationRecoverySnapshot(snapshot: ImageGenerationRecoverySnapshot) {
  lastRecoverySnapshot = snapshot;
}

/**
 * 获取启动时的 stale 任务恢复快照。
 */
export function getImageGenerationRecoverySnapshot() {
  return lastRecoverySnapshot;
}

/**
 * 获取图片生成队列监控视图：状态汇总、等待 / 处理中任务、最近失败任务、stale 恢复结果。
 */
export async function getImageGenerationMonitorView(): Promise<ImageGenerationMonitorView> {
  const queue = getImageGenerationQueueStatus();
  const queueJobIds = queue.queueTasks.map((task) => task.id);
  const processingJobIds = queue.processingTasks;

  const [statusGroups, queuedLogs, processingLogs, recentFailedLogs] = await Promise.all([
    prisma.tbImageGenLog.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    queueJobIds.length > 0
      ? prisma.tbImageGenLog.findMany({ where: { job_id: { in: queueJobIds } } })
      : Promise.resolve<TbImageGenLog[]>([]),
    processingJobIds.length > 0
      ? prisma.tbImageGenLog.findMany({ where: { job_id: { in: processingJobIds } } })
      : Promise.resolve<TbImageGenLog[]>([]),
    prisma.tbImageGenLog.findMany({
      where: { status: 'FAILED' },
      orderBy: { created_at: 'desc' },
      take: 10,
    }),
  ]);

  const counts: Record<ImageGenStatus, number> = {
    PENDING: 0,
    PROCESSING: 0,
    SUCCESS: 0,
    FAILED: 0,
  };

  for (const item of statusGroups) {
    if (item.status in counts) {
      counts[item.status as ImageGenStatus] = item._count._all;
    }
  }

  const queuedLogMap = new Map(queuedLogs.map((log) => [log.job_id, log] as const));
  const processingLogMap = new Map(processingLogs.map((log) => [log.job_id, log] as const));

  return {
    queue,
    counts,
    queueTasks: queue.queueTasks
      .map((task) => queuedLogMap.get(task.id))
      .filter((log): log is TbImageGenLog => Boolean(log))
      .map(toQueueLogSummary),
    processingTasks: queue.processingTasks
      .map((jobId) => processingLogMap.get(jobId))
      .filter((log): log is TbImageGenLog => Boolean(log))
      .map(toQueueLogSummary),
    recentFailedTasks: recentFailedLogs.map(toQueueLogSummary),
    staleRecovery: getImageGenerationRecoverySnapshot(),
  };
}

/**
 * 重试失败的图片生成任务：先入队（幂等去重），成功后再重置 DB 状态，避免遗留无人处理的 PENDING。
 */
export async function retryImageGenerationJob(jobId: string, user: AuthUser) {
  const existing = await prisma.tbImageGenLog.findUnique({
    where: { job_id: jobId },
  });

  if (!existing || !existing.job_id) {
    throw new Error('图片生成任务不存在');
  }

  const canViewAll = user.permissions.includes(USER_MANAGE);
  if (!canViewAll && existing.user_id !== user.id) {
    throw new Error('无权重试该任务');
  }

  if (existing.status !== 'FAILED') {
    throw new Error('仅支持重试失败任务');
  }

  const enqueued = imageGenerationQueue.add({
    id: jobId,
    type: 'image-generation',
    payload: { jobId },
    title: existing.prompt.slice(0, 60),
    priority: 5,
    addTime: Date.now(),
  });

  if (!enqueued) {
    // 任务已在队列或处理中（内存与 DB 短暂不一致），不重复入队、不动 DB
    throw new Error('该任务已在队列或处理中，请稍后刷新查看');
  }

  const resetLog = await prisma.tbImageGenLog.update({
    where: { job_id: jobId },
    data: {
      status: 'PENDING',
      error_message: null,
      duration_ms: 0,
      started_at: null,
      finished_at: null,
      model: null,
      original_url: null,
      cdn_url: null,
    },
  });

  const job = formatImageGenerationJob(resetLog);
  if (!job) {
    throw new Error('图片生成任务重试失败');
  }

  return job;
}
