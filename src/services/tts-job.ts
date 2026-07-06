/**
 * TTS 语音合成异步任务服务
 *
 * 使用通用 tb_ai_job 表（type='tts'）。
 * 镜像 image-gen-job.ts 的架构。
 */

import { prisma } from '@/lib/prisma';
import { generateUuid } from '@/lib/uuid';
import { USER_MANAGE } from '@/constants/permissions';
import type { TtsOptions } from '@/services/tts';
import { TaskQueue, type QueueTask } from '@/services/queue/task-queue';
import type { AuthUser } from '@/types/auth';
import type { AiJobSource, AiJobStatus } from '@/services/ai-job-log';
import type { TbAiJob } from '@/generated/prisma-client/client';
import {
  normalizeCosKey,
  getReservedCdnUrlForCosKey,
  formatAiJob,
  toQueueLogSummary,
  recoverStaleJobs,
  type AiJobView,
  type QueueLogSummary,
  type RecoverySnapshot,
} from '@/services/ai-job';

interface TtsTaskPayload {
  jobId: string;
}

type TtsQueueTask = QueueTask<'tts', TtsTaskPayload>;

interface CreateTTSJobParams {
  options: TtsOptions;
  userId: number;
  source: AiJobSource;
  priority?: number;
}

export interface TTSJobView extends AiJobView {
  // TTS 特有的字段（从 extJson 提取）
  voice: string | null;
  instruction: string | null;
  format: string | null;
  audioUrl: string | null;  // 别名，指向 resourceUrl
}

export interface TTSMonitorView {
  queue: ReturnType<typeof getTtsQueueStatus>;
  counts: Record<AiJobStatus, number>;
  queueTasks: QueueLogSummary[];
  processingTasks: QueueLogSummary[];
  recentFailedTasks: QueueLogSummary[];
  staleRecovery: RecoverySnapshot | null;
}

function readQueueNumber(value: string | undefined, fallback: number, min: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

const TTS_QUEUE_CONFIG = {
  concurrency: readQueueNumber(process.env.TTS_QUEUE_CONCURRENCY, 1, 1),
  maxRetries: readQueueNumber(process.env.TTS_QUEUE_MAX_RETRIES, 0, 0),
  retryDelay: readQueueNumber(process.env.TTS_QUEUE_RETRY_DELAY, 5000, 0),
  checkInterval: readQueueNumber(process.env.TTS_QUEUE_CHECK_INTERVAL, 1000, 100),
};

let lastRecoverySnapshot: RecoverySnapshot | null = null;

/**
 * 将通用 AiJobView 扩展为 TTSJobView（提取 TTS 特有字段）。
 */
function toTTSJobView(job: AiJobView | null): TTSJobView | null {
  if (!job) return null;

  const extJson = job.extJson || {};
  return {
    ...job,
    voice: (extJson.voice as string) || null,
    instruction: (extJson.instruction as string) || null,
    format: (extJson.format as string) || 'wav',
    audioUrl: job.resourceUrl,
  };
}

/**
 * 处理单个 TTS 任务：抢占、调用 MiMo API、上传 CDN、回写状态。
 */
async function processTTSJob(jobId: string) {
  const job = await prisma.tbAiJob.findUnique({
    where: { job_id: jobId, type: 'tts' },
  });

  if (!job) {
    throw new Error(`TTS 任务不存在: ${jobId}`);
  }

  if (job.status === 'SUCCESS') {
    return;
  }

  const startedAt = new Date();
  const startTime = Date.now();

  const claimed = await prisma.tbAiJob.updateMany({
    where: { job_id: jobId, type: 'tts', status: 'PENDING' },
    data: {
      status: 'PROCESSING',
      error_message: null,
      started_at: job.started_at || startedAt,
    },
  });

  if (claimed.count === 0) {
    console.log(`TTS 任务 ${jobId} 已被其他 worker 处理，跳过`);
    return;
  }

  try {
    const { synthesizeSpeech } = await import('@/services/tts');
    const { uploadFileToCOS } = await import('@/services/file-upload');

    // 从 ext_json 提取 TTS 特有参数
    const extJson = job.ext_json ? JSON.parse(job.ext_json) : {};

    const result = await synthesizeSpeech({
      text: job.prompt,
      model: job.model || undefined,
      voice: extJson.voice || undefined,
      instruction: extJson.instruction || undefined,
    });

    // 上传 base64 音频到 COS
    const cdnUrl = await uploadFileToCOS({
      buffer: Buffer.from(result.audioBase64, 'base64'),
      filename: `${jobId}.wav`,
      ext: '.wav',
      mimetype: 'audio/wav',
      key: job.cos_key || undefined,
    });

    const durationMs = Date.now() - startTime;
    await prisma.tbAiJob.update({
      where: { job_id: jobId },
      data: {
        status: 'SUCCESS',
        model: result.model,
        original_url: 'b64_json',
        cdn_url: cdnUrl,
        reserved_cdn_url: cdnUrl,
        duration_ms: durationMs,
        error_message: null,
        finished_at: new Date(),
        // 回写实际生效的 voice
        ext_json: JSON.stringify({
          ...extJson,
          voice: result.voice,
          format: result.format,
        }),
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : '语音合成失败';

    await prisma.tbAiJob.update({
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

export const ttsQueue = new TaskQueue<TtsQueueTask>(
  {
    name: 'tts',
    ...TTS_QUEUE_CONFIG,
  },
  {
    process: async (task) => {
      await processTTSJob(task.payload.jobId);
    },
    onRetry: (task, error, nextAttempt) => {
      console.error(`TTS 任务 ${task.id} 准备重试第 ${nextAttempt} 次`, error);
    },
  },
);

/**
 * 创建 TTS 任务：预分配 UUID / COS Key / 预留 CDN URL，单次写入后入队。
 */
export async function createTTSJob(params: CreateTTSJobParams) {
  const { validateTtsOptions } = await import('@/services/tts');
  validateTtsOptions(params.options);

  const jobId = generateUuid();
  const cosKey = normalizeCosKey('tts', jobId);
  const reservedCdnUrl = getReservedCdnUrlForCosKey(cosKey);

  // 构造 ext_json
  const extJson: Record<string, unknown> = {};
  if (params.options.voice) extJson.voice = params.options.voice;
  if (params.options.instruction) extJson.instruction = params.options.instruction;
  extJson.format = 'wav';

  const log = await prisma.tbAiJob.create({
    data: {
      job_id: jobId,
      type: 'tts',
      user_id: params.userId,
      source: params.source,
      prompt: params.options.text,
      model: params.options.model || null,
      original_url: null,
      cdn_url: null,
      reserved_cdn_url: reservedCdnUrl,
      cos_key: cosKey,
      status: 'PENDING',
      error_message: null,
      duration_ms: 0,
      ext_text: params.options.instruction || null,
      ext_json: JSON.stringify(extJson),
    },
  });

  ttsQueue.add({
    id: jobId,
    type: 'tts',
    payload: { jobId },
    title: params.options.text.slice(0, 60),
    priority: params.priority ?? 5,
    addTime: Date.now(),
  });

  const job = toTTSJobView(formatAiJob(log));
  if (!job) {
    throw new Error('TTS 任务创建失败');
  }

  return job;
}

/**
 * 查询 TTS 任务状态（带归属校验，未鉴权或越权访问返回 null）。
 */
export async function getTTSJob(jobId: string, user?: AuthUser | null) {
  const { getAiJob } = await import('@/services/ai-job');
  const job = await getAiJob(jobId, user, 'tts');
  return toTTSJobView(job);
}

/**
 * 获取 TTS 内存队列状态快照。
 */
export function getTtsQueueStatus() {
  return ttsQueue.getStatus();
}

/**
 * 设置启动时的 stale 任务恢复快照。
 */
export function setTtsRecoverySnapshot(snapshot: RecoverySnapshot) {
  lastRecoverySnapshot = snapshot;
}

/**
 * 获取启动时的 stale 任务恢复快照。
 */
export function getTtsRecoverySnapshot() {
  return lastRecoverySnapshot;
}

/**
 * 恢复 stale TTS 任务。
 */
export async function recoverStaleTtsJobs(queue: TaskQueue<TtsQueueTask>): Promise<RecoverySnapshot> {
  const snapshot = await recoverStaleJobs(queue, 'tts');
  setTtsRecoverySnapshot(snapshot);
  return snapshot;
}

/**
 * 获取 TTS 队列监控视图。
 */
export async function getTtsMonitorView(): Promise<TTSMonitorView> {
  const queue = getTtsQueueStatus();
  const queueJobIds = queue.queueTasks.map((task) => task.id);
  const processingJobIds = queue.processingTasks;

  const [statusGroups, queuedLogs, processingLogs, recentFailedLogs] = await Promise.all([
    prisma.tbAiJob.groupBy({
      by: ['status'],
      where: { type: 'tts' },
      _count: { _all: true },
    }),
    queueJobIds.length > 0
      ? prisma.tbAiJob.findMany({ where: { job_id: { in: queueJobIds }, type: 'tts' } })
      : Promise.resolve<TbAiJob[]>([]),
    processingJobIds.length > 0
      ? prisma.tbAiJob.findMany({ where: { job_id: { in: processingJobIds }, type: 'tts' } })
      : Promise.resolve<TbAiJob[]>([]),
    prisma.tbAiJob.findMany({
      where: { type: 'tts', status: 'FAILED' },
      orderBy: { created_at: 'desc' },
      take: 10,
    }),
  ]);

  const counts: Record<AiJobStatus, number> = {
    PENDING: 0,
    PROCESSING: 0,
    SUCCESS: 0,
    FAILED: 0,
  };

  for (const item of statusGroups) {
    if (item.status in counts) {
      counts[item.status as AiJobStatus] = item._count._all;
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
    staleRecovery: getTtsRecoverySnapshot(),
  };
}

/**
 * 重试失败的 TTS 任务。
 */
export async function retryTTSJob(jobId: string, user: AuthUser) {
  const existing = await prisma.tbAiJob.findUnique({
    where: { job_id: jobId, type: 'tts' },
  });

  if (!existing || !existing.job_id) {
    throw new Error('TTS 任务不存在');
  }

  const canViewAll = user.permissions.includes(USER_MANAGE);
  if (!canViewAll && existing.user_id !== user.id) {
    throw new Error('无权重试该任务');
  }

  if (existing.status !== 'FAILED') {
    throw new Error('仅支持重试失败任务');
  }

  const enqueued = ttsQueue.add({
    id: jobId,
    type: 'tts',
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

  const job = toTTSJobView(formatAiJob(resetLog));
  if (!job) {
    throw new Error('TTS 任务重试失败');
  }

  return job;
}
