import { getPrisma } from '@/lib/prisma';
import type { NotificationType } from '@/types/notification';
import { notificationSettingKey, parseNotificationSettings } from '@/types/notification';

const PAGE_SIZE_MAX = 50;

export async function getNotificationSettings(userId: number) {
  const prisma = await getPrisma();
  const user = await prisma.tbUser.findUnique({
    where: { id: userId },
    select: { notification_settings: true },
  });
  if (!user) throw new Error('用户不存在');
  return parseNotificationSettings(user.notification_settings);
}

export async function updateNotificationSettings(userId: number, settings: unknown) {
  const prisma = await getPrisma();
  const next = parseNotificationSettings(settings);
  await prisma.tbUser.update({
    where: { id: userId },
    data: { notification_settings: next },
  });
  return next;
}

export function isInboxNotificationEnabled(settings: unknown, type: NotificationType) {
  return parseNotificationSettings(settings).inbox[notificationSettingKey(type)];
}

export function isEmailNotificationEnabled(settings: unknown, type: NotificationType) {
  const parsed = parseNotificationSettings(settings);
  const key = notificationSettingKey(type);
  return parsed.inbox[key] && parsed.email[key];
}

export async function getNotificationSummary(userId: number) {
  const prisma = await getPrisma();
  const [unreadCount, recent] = await Promise.all([
    prisma.tbNotification.count({ where: { recipient_user_id: userId, read_at: null } }),
    prisma.tbNotification.findMany({
      where: { recipient_user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 5,
      include: { actor: { select: { id: true, nickname: true, avatar: true } } },
    }),
  ]);
  return { unreadCount, recent };
}

export async function getNotifications(userId: number, params: { page?: number; pageSize?: number; unreadOnly?: boolean }) {
  const prisma = await getPrisma();
  const page = Math.max(1, Math.trunc(params.page || 1));
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Math.trunc(params.pageSize || 20)));
  const where = {
    recipient_user_id: userId,
    ...(params.unreadOnly ? { read_at: null } : {}),
  };
  const [total, record] = await Promise.all([
    prisma.tbNotification.count({ where }),
    prisma.tbNotification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { id: true, nickname: true, avatar: true } } },
    }),
  ]);
  return { total, page, pageSize, record };
}

export async function markNotificationRead(userId: number, id: number) {
  const prisma = await getPrisma();
  const result = await prisma.tbNotification.updateMany({
    where: { id, recipient_user_id: userId, read_at: null },
    data: { read_at: new Date() },
  });
  if (result.count === 0) {
    const exists = await prisma.tbNotification.findFirst({ where: { id, recipient_user_id: userId } });
    if (!exists) throw new Error('通知不存在');
  }
}

export async function markAllNotificationsRead(userId: number) {
  const prisma = await getPrisma();
  return prisma.tbNotification.updateMany({
    where: { recipient_user_id: userId, read_at: null },
    data: { read_at: new Date() },
  });
}
