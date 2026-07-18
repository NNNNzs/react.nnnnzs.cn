"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { notification } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import {
  TaskNotificationCoordinator,
  type TaskNotificationCoordinatorMessage,
} from '@/lib/task-notification-coordinator';
import {
  clearTaskNotificationCursor,
  DEFAULT_TASK_NOTIFICATION_PREFERENCES,
  hasConsumedTaskNotification,
  markTaskNotificationConsumed,
  readTaskNotificationCursor,
  readTaskNotificationPreferences,
  writeTaskNotificationCursor,
  writeTaskNotificationPreferences,
} from '@/lib/task-notification-storage';
import {
  registerTaskNotificationServiceWorker,
  showTaskDesktopNotification,
  supportsDesktopTaskNotifications,
} from '@/lib/task-notification-service-worker';
import type {
  TaskNotificationEvent,
  TaskNotificationPreferences,
  TaskNotificationSnapshot,
} from '@/types/task-notification';

const ACTIVE_POLL_INTERVAL_MS = 3000;
const IDLE_POLL_INTERVAL_MS = 15000;
const MAX_BACKOFF_MS = 60000;

interface TaskNotificationContextValue {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  preferences: TaskNotificationPreferences;
  activeCount: number;
  requestPermission: () => Promise<NotificationPermission | 'unsupported'>;
  updatePreferences: (patch: Partial<TaskNotificationPreferences>) => void;
}
const TaskNotificationContext = createContext<TaskNotificationContextValue | undefined>(undefined);

function getCurrentPermission(): NotificationPermission | 'unsupported' {
  return supportsDesktopTaskNotifications() ? Notification.permission : 'unsupported';
}

function isCurrentTaskPage(event: TaskNotificationEvent) {
  const currentUrl = new URL(window.location.href);
  const targetUrl = new URL(event.targetUrl, window.location.origin);
  return currentUrl.pathname === targetUrl.pathname
    && currentUrl.searchParams.get('jobId') === event.jobId;
}

export function TaskNotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [preferences, setPreferences] = useState<TaskNotificationPreferences>(
    DEFAULT_TASK_NOTIFICATION_PREFERENCES,
  );
  const [activeCount, setActiveCount] = useState(0);
  const [isLeader, setIsLeader] = useState(false);
  const coordinatorRef = useRef<TaskNotificationCoordinator | null>(null);

  useEffect(() => {
    const nextSupported = supportsDesktopTaskNotifications();
    setSupported(nextSupported);
    setPermission(nextSupported ? Notification.permission : 'unsupported');
  }, []);

  useEffect(() => {
    setActiveCount(0);
    setIsLeader(false);
    setPreferences(user
      ? readTaskNotificationPreferences(user.id)
      : DEFAULT_TASK_NOTIFICATION_PREFERENCES);
  }, [user]);

  const updatePreferences = useCallback((patch: Partial<TaskNotificationPreferences>) => {
    if (!user) return;
    setPreferences((current) => {
      const next = { ...current, ...patch };
      writeTaskNotificationPreferences(user.id, next);
      return next;
    });
  }, [user]);

  const requestPermission = useCallback(async () => {
    if (!supportsDesktopTaskNotifications()) {
      setPermission('unsupported');
      return 'unsupported' as const;
    }
    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    if (nextPermission === 'granted') {
      updatePreferences({ enabled: true });
      await registerTaskNotificationServiceWorker();
    } else if (nextPermission === 'denied') {
      updatePreferences({ enabled: false });
    }
    return nextPermission;
  }, [updatePreferences]);

  const handleCoordinatorMessage = useCallback((message: TaskNotificationCoordinatorMessage) => {
    if (message.kind === 'snapshot') {
      setActiveCount(message.activeCount);
      writeTaskNotificationCursor(message.userId, message.cursor);
    } else {
      markTaskNotificationConsumed(message.userId, message.eventId);
    }
  }, []);

  useEffect(() => {
    coordinatorRef.current?.stop();
    coordinatorRef.current = null;
    setIsLeader(false);

    if (!user || !preferences.enabled) return;
    const coordinator = new TaskNotificationCoordinator(user.id, {
      onLeaderChange: setIsLeader,
      onMessage: handleCoordinatorMessage,
    });
    coordinatorRef.current = coordinator;
    coordinator.start();
    return () => {
      coordinator.stop();
      if (coordinatorRef.current === coordinator) coordinatorRef.current = null;
    };
  }, [handleCoordinatorMessage, preferences.enabled, user]);

  const consumeEvent = useCallback(async (event: TaskNotificationEvent) => {
    if (!user || hasConsumedTaskNotification(user.id, event.eventId)) return;

    markTaskNotificationConsumed(user.id, event.eventId);
    coordinatorRef.current?.broadcast({ kind: 'consumed', userId: user.id, eventId: event.eventId });

    const typeEnabled = preferences.types.includes(event.type);
    const statusEnabled = event.status === 'SUCCESS'
      ? preferences.notifySuccess
      : preferences.notifyFailure;
    if (!typeEnabled || !statusEnabled || isCurrentTaskPage(event)) return;

    const navigate = () => {
      window.location.assign(event.targetUrl);
    };

    if (document.hidden && preferences.desktopWhenHidden && Notification.permission === 'granted') {
      const shown = await showTaskDesktopNotification(event);
      if (shown) return;
    }

    const typeLabel = event.type === 'image-gen' ? '图片生成' : '语音合成';
    const succeeded = event.status === 'SUCCESS';
    notificationApi.open({
      type: succeeded ? 'success' : 'error',
      message: `${typeLabel}${succeeded ? '完成' : '失败'}`,
      description: succeeded ? event.title : event.errorMessage || event.title,
      placement: 'bottomRight',
      duration: 6,
      onClick: navigate,
      className: 'cursor-pointer',
    });
  }, [notificationApi, preferences, user]);

  useEffect(() => {
    if (!user || !preferences.enabled || !isLeader) return;

    let stopped = false;
    let timer: number | null = null;
    let running = false;
    let failures = 0;

    const schedule = (delay: number) => {
      if (stopped) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void poll(), delay);
    };

    const poll = async () => {
      if (stopped || running || !navigator.onLine) return;
      running = true;
      try {
        const cursor = readTaskNotificationCursor(user.id);
        const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
        const response = await fetch(`/api/ai-jobs/notifications${query}`, {
          cache: 'no-store',
          credentials: 'include',
          headers: { 'Cache-Control': 'no-store' },
        });

        if (response.status === 400 && cursor) {
          clearTaskNotificationCursor(user.id);
          failures = 0;
          schedule(0);
          return;
        }
        if (response.status === 401 || response.status === 403) return;

        const payload = await response.json() as {
          status: boolean;
          message: string;
          data: TaskNotificationSnapshot;
        };
        if (!response.ok || !payload.status) throw new Error(payload.message || '查询任务通知失败');

        failures = 0;
        writeTaskNotificationCursor(user.id, payload.data.cursor);
        setActiveCount(payload.data.activeJobs.length);
        coordinatorRef.current?.broadcast({
          kind: 'snapshot',
          userId: user.id,
          activeCount: payload.data.activeJobs.length,
          cursor: payload.data.cursor,
        });

        for (const event of payload.data.terminalEvents) {
          await consumeEvent(event);
        }

        schedule(payload.data.hasMore
          ? 0
          : payload.data.activeJobs.length > 0
            ? ACTIVE_POLL_INTERVAL_MS
            : IDLE_POLL_INTERVAL_MS);
      } catch (error) {
        failures += 1;
        console.error('Poll task notifications failed:', error);
        schedule(Math.min(IDLE_POLL_INTERVAL_MS * (2 ** (failures - 1)), MAX_BACKOFF_MS));
      } finally {
        running = false;
      }
    };

    const pollNow = () => {
      if (!stopped && navigator.onLine) schedule(0);
      const currentPermission = getCurrentPermission();
      setPermission(currentPermission);
      if (currentPermission === 'denied') updatePreferences({ enabled: false });
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') pollNow();
    };

    window.addEventListener('online', pollNow);
    document.addEventListener('visibilitychange', handleVisibility);
    void registerTaskNotificationServiceWorker();
    schedule(0);

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('online', pollNow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [consumeEvent, isLeader, preferences.enabled, updatePreferences, user]);

  const value = useMemo<TaskNotificationContextValue>(() => ({
    supported,
    permission,
    preferences,
    activeCount,
    requestPermission,
    updatePreferences,
  }), [activeCount, permission, preferences, requestPermission, supported, updatePreferences]);

  return (
    <TaskNotificationContext.Provider value={value}>
      {notificationContextHolder}
      {children}
    </TaskNotificationContext.Provider>
  );
}

export function useTaskNotifications() {
  const context = useContext(TaskNotificationContext);
  if (!context) throw new Error('useTaskNotifications 必须在 TaskNotificationProvider 内使用');
  return context;
}
