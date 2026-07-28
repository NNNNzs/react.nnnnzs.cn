import crypto from 'crypto';
import type { NotificationType } from '@/types/notification';

interface UnsubscribePayload {
  userId: number;
  type: NotificationType;
  expiresAt: number;
}

interface NotificationReadPayload {
  userId: number;
  notificationId: number;
  targetUrl: string;
  expiresAt: number;
}

function getSecret() {
  return process.env.NOTIFICATION_UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || '';
}

function encode(payload: UnsubscribePayload | NotificationReadPayload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function sign(encoded: string) {
  const secret = getSecret();
  if (!secret) throw new Error('未配置通知退订签名密钥');
  return crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
}

export function createUnsubscribeToken(userId: number, type: NotificationType): string {
  const encoded = encode({ userId, type, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  return `${encoded}.${sign(encoded)}`;
}

export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as UnsubscribePayload;
    if (!Number.isInteger(payload.userId) || !['COMMENT_ON_POST', 'COMMENT_REPLY'].includes(payload.type) || payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createNotificationReadToken(userId: number, notificationId: number, targetUrl: string): string {
  const encoded = encode({ userId, notificationId, targetUrl, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  return `${encoded}.${sign(encoded)}`;
}

export function verifyNotificationReadToken(token: string): NotificationReadPayload | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as NotificationReadPayload;
    if (!Number.isInteger(payload.userId) || !Number.isInteger(payload.notificationId) || !payload.targetUrl.startsWith('/') || payload.targetUrl.startsWith('//') || payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
