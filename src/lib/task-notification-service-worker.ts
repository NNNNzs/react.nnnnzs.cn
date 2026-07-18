import type { TaskNotificationEvent } from '@/types/task-notification';

const SERVICE_WORKER_PATH = '/task-notification-sw.js';

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;

export function supportsDesktopTaskNotifications() {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator;
}
export async function registerTaskNotificationServiceWorker() {
  if (!supportsDesktopTaskNotifications()) return null;
  registrationPromise ??= navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: '/' });
  try {
    return await registrationPromise;
  } catch (error) {
    registrationPromise = null;
    console.error('Register task notification service worker failed:', error);
    return null;
  }
}

export async function showTaskDesktopNotification(event: TaskNotificationEvent) {
  const registration = await registerTaskNotificationServiceWorker();
  if (!registration || Notification.permission !== 'granted') return false;

  const typeLabel = event.type === 'image-gen' ? '图片生成' : '语音合成';
  const succeeded = event.status === 'SUCCESS';
  await registration.showNotification(`${typeLabel}${succeeded ? '完成' : '失败'}`, {
    body: succeeded ? event.title : event.errorMessage || event.title,
    icon: '/favicon-light.png',
    badge: '/favicon-light.png',
    tag: `ai-job:${event.jobId}:${event.status}`,
    data: { targetUrl: event.targetUrl },
  });
  return true;
}
