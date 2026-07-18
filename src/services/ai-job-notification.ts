import { IMAGE_VIEW, TTS_VIEW } from '@/constants/permissions';
import { prisma } from '@/lib/prisma';
import type { AuthUser } from '@/types/auth';
import type {
  TaskNotificationActiveJob,
  TaskNotificationEvent,
  TaskNotificationJobType,
  TaskNotificationSnapshot,
} from '@/types/task-notification';
import type { TbAiJob } from '@/generated/prisma-client/client';

const PAGE_SIZE = 50;
const TITLE_MAX_LENGTH = 80;
const ERROR_MAX_LENGTH = 160;

interface NotificationCursor {
  finishedAt: string;
  id: number;
}

export class InvalidTaskNotificationCursorError extends Error {
  constructor() {
    super('无效的任务通知游标');
    this.name = 'InvalidTaskNotificationCursorError';
  }
}

function truncate(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}…`
    : normalized;
}

function parseImageError(value: string) {
  try {
    const parsed = JSON.parse(value) as { message?: unknown };
    return typeof parsed.message === 'string' ? parsed.message : value;
  } catch {
    return value;
  }
}

function formatErrorMessage(job: TbAiJob) {
  if (!job.error_message) return null;
  const message = job.type === 'image-gen'
    ? parseImageError(job.error_message)
    : job.error_message;
  return truncate(message, ERROR_MAX_LENGTH);
}

function getTargetUrl(type: TaskNotificationJobType, jobId: string) {
  const route = type === 'image-gen' ? '/c/image-gen' : '/c/tts';
  return `${route}?jobId=${encodeURIComponent(jobId)}`;
}

function getResourceUrl(job: TbAiJob) {
  if (job.status !== 'SUCCESS') return null;
  return job.cdn_url || job.reserved_cdn_url || job.original_url || null;
}

function encodeCursor(cursor: NotificationCursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string): NotificationCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<NotificationCursor>;
    const timestamp = typeof parsed.finishedAt === 'string'
      ? Date.parse(parsed.finishedAt)
      : Number.NaN;
    if (!Number.isFinite(timestamp) || !Number.isInteger(parsed.id) || (parsed.id ?? -1) < 0) {
      throw new InvalidTaskNotificationCursorError();
    }
    return { finishedAt: new Date(timestamp).toISOString(), id: parsed.id as number };
  } catch (error) {
    if (error instanceof InvalidTaskNotificationCursorError) throw error;
    throw new InvalidTaskNotificationCursorError();
  }
}

export function getAllowedTaskNotificationTypes(user: AuthUser): TaskNotificationJobType[] {
  const types: TaskNotificationJobType[] = [];
  if (user.permissions.includes(IMAGE_VIEW)) types.push('image-gen');
  if (user.permissions.includes(TTS_VIEW)) types.push('tts');
  return types;
}

function toActiveJob(job: TbAiJob): TaskNotificationActiveJob {
  return {
    jobId: job.job_id as string,
    type: job.type as TaskNotificationJobType,
    status: job.status as TaskNotificationActiveJob['status'],
    title: truncate(job.prompt, TITLE_MAX_LENGTH),
    createdAt: job.created_at.toISOString(),
  };
}

function toTerminalEvent(job: TbAiJob): TaskNotificationEvent {
  const finishedAt = job.finished_at as Date;
  return {
    eventId: `${job.job_id}:${job.status}:${finishedAt.toISOString()}`,
    jobId: job.job_id as string,
    type: job.type as TaskNotificationJobType,
    status: job.status as TaskNotificationEvent['status'],
    title: truncate(job.prompt, TITLE_MAX_LENGTH),
    errorMessage: formatErrorMessage(job),
    resourceUrl: getResourceUrl(job),
    finishedAt: finishedAt.toISOString(),
    targetUrl: getTargetUrl(job.type as TaskNotificationJobType, job.job_id as string),
  };
}

export async function getTaskNotificationSnapshot(
  user: AuthUser,
  cursorValue?: string | null,
): Promise<TaskNotificationSnapshot> {
  const types = getAllowedTaskNotificationTypes(user);
  const cursor = cursorValue ? decodeCursor(cursorValue) : null;
  const baselineAt = new Date();

  if (types.length === 0) {
    const baseline = cursor || { finishedAt: baselineAt.toISOString(), id: 0 };
    return { cursor: encodeCursor(baseline), activeJobs: [], terminalEvents: [], hasMore: false };
  }

  return prisma.$transaction(async (tx) => {
    const activeJobsPromise = tx.tbAiJob.findMany({
      where: {
        user_id: user.id,
        type: { in: types },
        status: { in: ['PENDING', 'PROCESSING'] },
        job_id: { not: null },
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: 100,
    });

    if (!cursor) {
      const [activeJobs, latestTerminal] = await Promise.all([
        activeJobsPromise,
        tx.tbAiJob.findFirst({
          where: {
            user_id: user.id,
            type: { in: types },
            status: { in: ['SUCCESS', 'FAILED'] },
            finished_at: { not: null },
            job_id: { not: null },
          },
          orderBy: [{ finished_at: 'desc' }, { id: 'desc' }],
        }),
      ]);

      const baseline = latestTerminal?.finished_at
        ? { finishedAt: latestTerminal.finished_at.toISOString(), id: latestTerminal.id }
        : { finishedAt: baselineAt.toISOString(), id: 0 };

      return {
        cursor: encodeCursor(baseline),
        activeJobs: activeJobs.map(toActiveJob),
        terminalEvents: [],
        hasMore: false,
      };
    }

    const cursorDate = new Date(cursor.finishedAt);
    const [activeJobs, terminalJobs] = await Promise.all([
      activeJobsPromise,
      tx.tbAiJob.findMany({
        where: {
          user_id: user.id,
          type: { in: types },
          status: { in: ['SUCCESS', 'FAILED'] },
          finished_at: { not: null },
          job_id: { not: null },
          OR: [
            { finished_at: { gt: cursorDate } },
            { finished_at: cursorDate, id: { gt: cursor.id } },
          ],
        },
        orderBy: [{ finished_at: 'asc' }, { id: 'asc' }],
        take: PAGE_SIZE + 1,
      }),
    ]);

    const page = terminalJobs.slice(0, PAGE_SIZE);
    const lastJob = page.at(-1);
    const nextCursor = lastJob?.finished_at
      ? { finishedAt: lastJob.finished_at.toISOString(), id: lastJob.id }
      : cursor;

    return {
      cursor: encodeCursor(nextCursor),
      activeJobs: activeJobs.map(toActiveJob),
      terminalEvents: page.map(toTerminalEvent),
      hasMore: terminalJobs.length > PAGE_SIZE,
    };
  }, { isolationLevel: 'RepeatableRead' });
}
