import type { AiJobStatus, AiJobType } from '@/services/ai-job-log';

export type TaskNotificationJobType = Extract<AiJobType, 'image-gen' | 'tts'>;
export type TaskNotificationActiveStatus = Extract<AiJobStatus, 'PENDING' | 'PROCESSING'>;
export type TaskNotificationTerminalStatus = Extract<AiJobStatus, 'SUCCESS' | 'FAILED'>;

export interface TaskNotificationActiveJob {
  jobId: string;
  type: TaskNotificationJobType;
  status: TaskNotificationActiveStatus;
  title: string;
  createdAt: string;
}
export interface TaskNotificationEvent {
  eventId: string;
  jobId: string;
  type: TaskNotificationJobType;
  status: TaskNotificationTerminalStatus;
  title: string;
  errorMessage: string | null;
  resourceUrl: string | null;
  finishedAt: string;
  targetUrl: string;
}

export interface TaskNotificationSnapshot {
  cursor: string;
  activeJobs: TaskNotificationActiveJob[];
  terminalEvents: TaskNotificationEvent[];
  hasMore: boolean;
}

export interface TaskNotificationPreferences {
  enabled: boolean;
  notifySuccess: boolean;
  notifyFailure: boolean;
  types: TaskNotificationJobType[];
  desktopWhenHidden: boolean;
}
