import { z } from 'zod';

export const NOTIFICATION_TYPES = ['COMMENT_ON_POST', 'COMMENT_REPLY'] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

export const defaultNotificationSettings = {
  version: 1,
  inbox: {
    postComment: true,
    commentReply: true,
  },
  email: {
    postComment: true,
    commentReply: true,
  },
} as const;

export const notificationSettingsSchema = z.object({
  version: z.literal(1),
  inbox: z.object({
    postComment: z.boolean(),
    commentReply: z.boolean(),
  }),
  email: z.object({
    postComment: z.boolean(),
    commentReply: z.boolean(),
  }),
}).strip();

export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

export function parseNotificationSettings(value: unknown): NotificationSettings {
  const parsed = notificationSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : structuredClone(defaultNotificationSettings);
}

export function notificationSettingKey(type: NotificationType): 'postComment' | 'commentReply' {
  return type === 'COMMENT_ON_POST' ? 'postComment' : 'commentReply';
}

export function truncateNotificationPreview(content: string, maxLength = 120): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}
