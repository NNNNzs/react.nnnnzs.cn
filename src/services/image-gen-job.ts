/**
 * 图片生成异步任务服务
 *
 * 使用通用 tb_ai_job 表（type='image-gen'）。
 */

import { prisma } from '@/lib/prisma';
import { generateUuid } from '@/lib/uuid';
import { USER_MANAGE } from '@/constants/permissions';
import type { ImageGenOptions } from '@/services/image-gen';
import { TaskQueue, type QueueTask } from '@/services/queue/task-queue';
import type { AuthUser } from '@/types/auth';
import type { ImageGenSource, ImageGenStatus } from '@/services/image-gen-log';
import type { TbAiJob } from '@/generated/prisma-client/client';
import {
  normalizeCosKey,
  getReservedCdnUrlForCosKey,
  formatAiJob,
  toQueueLogSummary,
  type AiJobView,
  type QueueLogSummary,
  type RecoverySnapshot,
} from '@/services/ai-job';

interface ImageGenerationTaskPayload {
  jobId: string;
}

type ImageGenerationQueueTask = QueueTask<'image-generation', ImageGenerationTaskPayload>;

interface CreateImageGenerationJobParams {
  options: ImageGenOptions;
  userId: number;
  source: ImageGenSource;
  group?: string;
  priority?: number;
}

export type ImageGenerationRecoverySnapshot = RecoverySnapshot;

export interface ImageGenerationJobView extends AiJobView {
  // 图片生成特有的字段（从 extJson 提取）
  mode: 'generate' | 'edit';
  group: string | null;
  referenceImageUrls: string[];
  imageUrl: string | null;  // 别名，指向 resourceUrl
}

export interface ImageGenerationMonitorView {
  queue: ReturnType<typeof getImageGenerationQueueStatus>;
  counts: Record<ImageGenStatus, number>;
  queueTasks: QueueLogSummary[];
  processingTasks: QueueLogSummary[];
  recentFailedTasks: QueueLogSummary[];
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
 * 将通用 AiJobView 扩展为 ImageGenerationJobView（提取图片特有字段）。
 */
function toImageGenerationJobView(job: AiJobView | null): ImageGenerationJobView | null {
  if (!job) return null;

  const extJson = job.extJson || {};
  const editImageUrls = Array.isArray(extJson.edit_image_urls)
    ? extJson.edit_image_urls.filter((url): url is string => typeof url === 'string')
    : (typeof extJson.edit_image_url === 'string' ? [extJson.edit_image_url] : []);

  return {
    ...job,
    resourceUri: `blog://image-generation-jobs/${job.jobId}`,
    mode: (extJson.mode as 'generate' | 'edit') || 'generate',
    group: typeof extJson.group === 'string' ? extJson.group : null,
    referenceImageUrls: editImageUrls,
    imageUrl: job.resourceUrl,
  };
}

/**
 * 处理单个图片生成任务：抢占、调用模型、上传 CDN、回写状态。
 */
async function processImageGenerationJob(jobId: string) {
  const job = await prisma.tbAiJob.findUnique({
    where: { job_id: jobId, type: 'image-gen' },
  });

  if (!job) {
    throw new Error(`图片生成任务不存在: ${jobId}`);
  }

  if (job.status === 'SUCCESS') {
    return;
  }

  const startedAt = new Date();
  const startTime = Date.now();

  const claimed = await prisma.tbAiJob.updateMany({
    where: { job_id: jobId, type: 'image-gen', status: 'PENDING' },
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

  // 从 ext_json 提取图片特有参数
  const extJson = job.ext_json ? JSON.parse(job.ext_json) : {};
  const editImageUrls = Array.isArray(extJson.edit_image_urls)
    ? extJson.edit_image_urls.filter((url: unknown): url is string => typeof url === 'string')
    : (typeof extJson.edit_image_url === 'string' ? [extJson.edit_image_url] : []);
  const options: ImageGenOptions = {
    mode: extJson.mode || 'generate',
    prompt: job.prompt,
    ...(editImageUrls.length > 0 ? { images: editImageUrls, image: editImageUrls[0] } : {}),
  };

  try {
    const { generateImage, uploadGeneratedImageToCDN } = await import('@/services/image-gen');
    const result = await generateImage(options);
    const cdnUrl = await uploadGeneratedImageToCDN(result, {
      key: job.cos_key || undefined,
    });
    const durationMs = Date.now() - startTime;

    await prisma.tbAiJob.update({
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

    // 将完整的任务上下文附加到错误消息中，方便队列监控页展示
    const fullError = JSON.stringify({
      message: errorMessage,
      jobId,
      mode: options.mode,
      prompt: options.prompt?.slice(0, 200),
      imageCount: editImageUrls.length,
      durationMs,
    });

    await prisma.tbAiJob.update({
      where: { job_id: jobId },
      data: {
        status: 'FAILED',
        error_message: fullError,
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
  const cosKey = normalizeCosKey('image-gen', jobId);
  const reservedCdnUrl = getReservedCdnUrlForCosKey(cosKey);

  // 构造 ext_json
  const extJson: Record<string, unknown> = {
    mode: params.options.mode || 'generate',
  };
  if (params.options.mode === 'edit') {
    const { normalizeImageInputs } = await import('@/services/image-gen');
    const editImageUrls = normalizeImageInputs(params.options);
    if (editImageUrls.length > 0) {
      extJson.edit_image_url = editImageUrls[0];
      extJson.edit_image_urls = editImageUrls;
    }
  }
  if (params.group?.trim()) extJson.group = params.group.trim();

  const log = await prisma.tbAiJob.create({
    data: {
      job_id: jobId,
      type: 'image-gen',
      user_id: params.userId,
      source: params.source,
      prompt: params.options.prompt,
      model: null,
      original_url: null,
      cdn_url: null,
      reserved_cdn_url: reservedCdnUrl,
      cos_key: cosKey,
      status: 'PENDING',
      error_message: null,
      duration_ms: 0,
      ext_text: params.options.mode === 'edit' ? params.options.prompt : null,
      ext_json: JSON.stringify(extJson),
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

  const job = toImageGenerationJobView(formatAiJob(log));
  if (!job) {
    throw new Error('图片生成任务创建失败');
  }

  return job;
}

/**
 * 查询图片生成任务状态（带归属校验，未鉴权或越权访问返回 null）。
 */
export async function getImageGenerationJob(jobId: string, user?: AuthUser | null) {
  const { getAiJob } = await import('@/services/ai-job');
  const job = await getAiJob(jobId, user, 'image-gen');
  return toImageGenerationJobView(job);
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
    prisma.tbAiJob.groupBy({
      by: ['status'],
      where: { type: 'image-gen' },
      _count: { _all: true },
    }),
    queueJobIds.length > 0
      ? prisma.tbAiJob.findMany({ where: { job_id: { in: queueJobIds }, type: 'image-gen' } })
      : Promise.resolve<TbAiJob[]>([]),
    processingJobIds.length > 0
      ? prisma.tbAiJob.findMany({ where: { job_id: { in: processingJobIds }, type: 'image-gen' } })
      : Promise.resolve<TbAiJob[]>([]),
    prisma.tbAiJob.findMany({
      where: { type: 'image-gen', status: 'FAILED' },
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
      .filter((log): log is TbAiJob => Boolean(log))
      .map(toQueueLogSummary),
    processingTasks: queue.processingTasks
      .map((jobId) => processingLogMap.get(jobId))
      .filter((log): log is TbAiJob => Boolean(log))
      .map(toQueueLogSummary),
    recentFailedTasks: recentFailedLogs.map(toQueueLogSummary),
    staleRecovery: getImageGenerationRecoverySnapshot(),
  };
}

/**
 * 重试失败的图片生成任务：先入队（幂等去重），成功后再重置 DB 状态，避免遗留无人处理的 PENDING。
 */
export async function retryImageGenerationJob(jobId: string, user: AuthUser) {
  const existing = await prisma.tbAiJob.findUnique({
    where: { job_id: jobId, type: 'image-gen' },
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
    throw new Error('该任务已在队列或处理中，请稍后刷新查看');
  }

  const resetLog = await prisma.tbAiJob.update({
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

  const job = toImageGenerationJobView(formatAiJob(resetLog));
  if (!job) {
    throw new Error('图片生成任务重试失败');
  }

  return job;
}
