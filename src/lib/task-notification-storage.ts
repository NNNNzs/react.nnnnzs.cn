import type { TaskNotificationPreferences } from '@/types/task-notification';

const STORAGE_PREFIX = 'ai-task-notifications';
const MAX_CONSUMED_EVENTS = 200;
const CONSUMED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface ConsumedEventRecord {
  eventId: string;
  consumedAt: number;
}
export const DEFAULT_TASK_NOTIFICATION_PREFERENCES: TaskNotificationPreferences = {
  enabled: false,
  notifySuccess: true,
  notifyFailure: true,
  types: ['image-gen', 'tts'],
  desktopWhenHidden: true,
};

function key(userId: number, suffix: string) {
  return `${STORAGE_PREFIX}:${userId}:${suffix}`;
}

function readJson<T>(storageKey: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(storageKey);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function writeJson(storageKey: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // 浏览器禁用或耗尽 localStorage 时仅失去跨刷新持久化，不阻塞任务页面。
  }
}

export function readTaskNotificationPreferences(userId: number) {
  const stored = readJson<Partial<TaskNotificationPreferences>>(key(userId, 'preferences'));
  return {
    ...DEFAULT_TASK_NOTIFICATION_PREFERENCES,
    ...stored,
    types: Array.isArray(stored?.types)
      ? stored.types.filter((type) => type === 'image-gen' || type === 'tts')
      : DEFAULT_TASK_NOTIFICATION_PREFERENCES.types,
  } satisfies TaskNotificationPreferences;
}

export function writeTaskNotificationPreferences(
  userId: number,
  preferences: TaskNotificationPreferences,
) {
  writeJson(key(userId, 'preferences'), preferences);
}

export function readTaskNotificationCursor(userId: number) {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key(userId, 'cursor'));
}

export function writeTaskNotificationCursor(userId: number, cursor: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key(userId, 'cursor'), cursor);
}

export function clearTaskNotificationCursor(userId: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key(userId, 'cursor'));
}

function readConsumedEvents(userId: number) {
  const now = Date.now();
  const events = readJson<ConsumedEventRecord[]>(key(userId, 'consumed')) || [];
  return events
    .filter((item) => item && typeof item.eventId === 'string' && now - item.consumedAt <= CONSUMED_TTL_MS)
    .slice(-MAX_CONSUMED_EVENTS);
}

export function hasConsumedTaskNotification(userId: number, eventId: string) {
  return readConsumedEvents(userId).some((item) => item.eventId === eventId);
}

export function markTaskNotificationConsumed(userId: number, eventId: string) {
  const events = readConsumedEvents(userId).filter((item) => item.eventId !== eventId);
  events.push({ eventId, consumedAt: Date.now() });
  writeJson(key(userId, 'consumed'), events.slice(-MAX_CONSUMED_EVENTS));
}

export function getTaskNotificationStoragePrefix(userId: number) {
  return `${STORAGE_PREFIX}:${userId}:`;
}
