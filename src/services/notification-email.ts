import { getPrisma } from '@/lib/prisma';
import { createUnsubscribeToken } from '@/lib/notification-unsubscribe';
import type { NotificationType } from '@/types/notification';
import { isEmailNotificationEnabled } from '@/services/notification';
import { parseNotificationSettings } from '@/types/notification';
import { getConfigByKey } from '@/services/config';

interface EmailNotificationInput {
  notificationId: number;
  recipientId: number;
  recipientMail: string | null;
  recipientSettings: unknown;
  type: NotificationType;
  actorName: string;
  postTitle: string;
  preview: string;
  targetUrl: string;
}

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.nnnnzs.cn').replace(/\/$/, '');
}

function getEmailApiUrl() {
  return process.env.EMAIL_NOTIFICATION_API_URL
    || `${(process.env.NEXT_PUBLIC_API_URL || 'https://api.nnnnzs.cn').replace(/\/$/, '')}/email/send`;
}

async function recordDelivery(notificationId: number, status: 'SENT' | 'FAILED' | 'SKIPPED', errorMessage?: string) {
  const prisma = await getPrisma();
  await prisma.tbNotificationDelivery.upsert({
    where: { notification_id: notificationId },
    create: {
      notification_id: notificationId,
      status,
      error_message: errorMessage?.slice(0, 500) || null,
      sent_at: status === 'SENT' ? new Date() : null,
    },
    update: {
      status,
      error_message: errorMessage?.slice(0, 500) || null,
      sent_at: status === 'SENT' ? new Date() : null,
    },
  });
}

export async function deliverNotificationEmail(input: EmailNotificationInput) {
  const settings = parseNotificationSettings(input.recipientSettings);
  if (!input.recipientMail || !isEmailNotificationEnabled(settings, input.type)) {
    await recordDelivery(input.notificationId, 'SKIPPED');
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const apiKeyConfig = await getConfigByKey('EMAIL_API_KEY');
    const apiKey = apiKeyConfig?.status === 0 ? null : apiKeyConfig?.value?.trim();
    if (!apiKey) throw new Error('未配置邮件服务 API Key');
    const unsubscribeToken = createUnsubscribeToken(input.recipientId, input.type);
    const response = await fetch(getEmailApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        idempotencyKey: `notification:${input.notificationId}`,
        to: input.recipientMail,
        fromName: 'NNNNzs',
        template: input.type === 'COMMENT_ON_POST' ? 'post_comment' : 'comment_reply',
        variables: {
          actorName: input.actorName,
          postTitle: input.postTitle,
          preview: input.preview,
          targetUrl: `${getSiteUrl()}${input.targetUrl}`,
          unsubscribeUrl: `${getSiteUrl()}/api/notifications/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`,
        },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`邮件服务返回 HTTP ${response.status}`);
    await recordDelivery(input.notificationId, 'SENT');
  } catch (error) {
    const message = error instanceof Error ? error.message : '邮件投递失败';
    console.error('通知邮件投递失败:', { notificationId: input.notificationId, message });
    await recordDelivery(input.notificationId, 'FAILED', message);
  } finally {
    clearTimeout(timer);
  }
}
