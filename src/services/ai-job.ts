/**
 * 通用 AI 任务核心服务
 *
 * 提取 image-gen-job.ts 和 tts-job.ts 的公共逻辑：
 * - COS Key 生成
 * - CDN URL 预分配
 * - Job 格式化
 * - 归属校验查询
 * - stale 任务恢复
 */

import { prisma } from '@/lib/prisma';
import { isUuid } from '@/lib/uuid';
import { USER_MANAGE } from '@/constants/permissions';
import type { AuthUser } from '@/types/auth';
import type { AiJobType, AiJobStatus } from '@/services/ai-job-log';
import type { TbAiJob } from '@/generated/prisma-client/client';
import type { TaskQueue } from '@/services/queue/task-queue';

/**
 * 通用 JobView 接口
 */
export interface AiJobView {
  id: number;
  jobId: string;
  type: AiJobType;
  status: AiJobStatus;
  ready: boolean;
  resourceUrl: string | null;     // SUCCESS 时的最终资源 URL
  reservedCdnUrl: string | null;
  cdnUrl: string | null;
  cosKey: string | null;
  originalUrl: string | null;
  errorMessage: string | null;
  source: string;
  prompt: string;
  model: string | null;
  elapsed: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  resourceUri: string;             // MCP resource URI
  statusUrl: string;               // 查询 API 路径
  extText: string | null;
  extJson: Record<string, unknown> | null;
}

/**
 * stale 任务恢复快照
 */
export interface RecoverySnapshot {
  recoveredAt: string;
  staleProcessingCount: number;
  requeuedPendingCount: number;
}

/**
 * 任务日志摘要（用于队列监控）
 */
export interface QueueLogSummary {
  id: number;
  jobId: string;
  type: AiJobType;
  prompt: string;
  source: string;
  status: AiJobStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

/**
 * 各场景的 COS Key 前缀和扩展名映射
 */
const AI_JOB_COS_CONFIG: Record<AiJobType, { prefix: string; ext: string }> = {
  'image-gen': { prefix: '/upload/image-gen', ext: '.png' },
  tts: { prefix: '/upload/tts', ext: '.wav' },
  'text-gen': { prefix: '/upload/text-gen', ext: '.txt' },
};

/**
 * 校验 jobId 并生成对应的 COS Key。
 */
export function normalizeCosKey(type: AiJobType, jobId: string) {
  if (!isUuid(jobId)) {
    throw new Error(`无效的 ${type} 任务 ID`);
  }

  const config = AI_JOB_COS_CONFIG[type];
  return `${config.prefix}/${jobId}${config.ext}`;
}

/**
 * 根据 COS Key 生成预分配的 CDN URL。
 */
export function getReservedCdnUrlForCosKey(cosKey: string) {
  const CDN_URL = process.env.CDN_URL || process.env.COS_CDN_URL;
  if (!CDN_URL) {
    throw new Error('COS 配置缺失：CDN_URL');
  }

  return `${CDN_URL.replace(/\/+$/, '')}${cosKey}`;
}

/**
 * 格式化耗时
 */
export function formatElapsed(durationMs: number) {
  return durationMs > 0 ? `${(durationMs / 1000).toFixed(1)}s` : null;
}

/**
 * 安全转换 Date 为 ISO 字符串
 */
export function toIsoString(date: Date | null) {
  return date ? date.toISOString() : null;
}

/**
 * 安全解析 JSON 字符串
 */
export function safeParseJson(jsonStr: string | null): Record<string, unknown> | null {
  if (!jsonStr) return null;
  try {
    const parsed = JSON.parse(jsonStr);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 将任务日志格式化为对外视图。
 */
export function formatAiJob(log: TbAiJob | null): AiJobView | null {
  if (!log || !log.job_id) return null;

  const status = log.status as AiJobStatus;
  const resourceUrl = status === 'SUCCESS'
    ? log.cdn_url || log.reserved_cdn_url || log.original_url || null
    : null;

  return {
    id: log.id,
    jobId: log.job_id,
    type: log.type as AiJobType,
    status,
    ready: status === 'SUCCESS',
    resourceUrl,
    reservedCdnUrl: log.reserved_cdn_url,
    cdnUrl: log.cdn_url,
    cosKey: log.cos_key,
    originalUrl: log.original_url,
    errorMessage: log.error_message,
    source: log.source,
    prompt: log.prompt,
    model: log.model,
    elapsed: formatElapsed(log.duration_ms),
    createdAt: log.created_at.toISOString(),
    startedAt: toIsoString(log.started_at),
    finishedAt: toIsoString(log.finished_at),
    resourceUri: `blog://${log.type}-jobs/${log.job_id}`,
    statusUrl: `/api/${log.type}/jobs/${log.job_id}`,
    extText: log.ext_text,
    extJson: safeParseJson(log.ext_json),
  };
}

/**
 * 将任务日志格式化为队列监控摘要。
 */
export function toQueueLogSummary(log: TbAiJob): QueueLogSummary {
  return {
    id: log.id,
    jobId: log.job_id || '',
    type: log.type as AiJobType,
    prompt: log.prompt,
    source: log.source,
    status: log.status as AiJobStatus,
    errorMessage: log.error_message,
    createdAt: log.created_at.toISOString(),
    updatedAt: toIsoString(log.updated_at),
    startedAt: toIsoString(log.started_at),
    finishedAt: toIsoString(log.finished_at),
  };
}

/**
 * 查询任务状态（带归属校验，未鉴权或越权访问返回 null）。
 */
export async function getAiJob(
  jobId: string,
  user?: AuthUser | null,
  type?: AiJobType,
): Promise<AiJobView | null> {
  const where: { job_id: string; type?: AiJobType } = { job_id: jobId };
  if (type) where.type = type;

  const log = await prisma.tbAiJob.findUnique({ where });

  if (!log) return null;
  if (!user) return null;

  const canViewAll = user.permissions.includes(USER_MANAGE);
  if (!canViewAll && log.user_id !== user.id) {
    return null;
  }

  return formatAiJob(log);
}

/**
 * 恢复 stale 任务（PROCESSING→FAILED，PENDING→重新入队）。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recoverStaleJobs(queue: TaskQueue<any>, type: AiJobType): Promise<RecoverySnapshot> {
  const staleProcessing = await prisma.tbAiJob.updateMany({
    where: {
      type,
      status: 'PROCESSING',
    },
    data: {
      status: 'FAILED',
      error_message: '服务重启，任务被中断',
      finished_at: new Date(),
    },
  });

  const pendingJobs = await prisma.tbAiJob.findMany({
    where: {
      type,
      status: 'PENDING',
    },
    select: { job_id: true, prompt: true },
  });

  for (const job of pendingJobs) {
    if (!job.job_id) continue;
    queue.add({
      id: job.job_id,
      type: type,
      payload: { jobId: job.job_id },
      title: job.prompt.slice(0, 60),
      priority: 5,
      addTime: Date.now(),
    });
  }

  const snapshot: RecoverySnapshot = {
    recoveredAt: new Date().toISOString(),
    staleProcessingCount: staleProcessing.count,
    requeuedPendingCount: pendingJobs.length,
  };

  return snapshot;
}
