/**
 * Google Analytics 4 事件追踪工具
 * 参考：https://developers.google.com/analytics/devguides/collection/ga4
 */

import type { NextRequest } from 'next/server';
import { getAnalyticsConfig } from './analytics-config';
import { proxyFetch } from './proxy-fetch';

/**
 * 从 Cookie 中提取 Session ID，或生成新的
 * session_id 必须是数字（10 位时间戳）
 *
 * 返回: [sessionId, needsSetCookie] - needsSetCookie 表示是否需要设置 Cookie
 */
function extractSessionId(request: NextRequest): [string, boolean] {
  const sessionCookie = request.cookies.get('ga_session_id');

  if (sessionCookie) {
    return [sessionCookie.value, false];
  }

  // 生成新的 Session ID（使用当前时间戳）
  return [Math.floor(Date.now() / 1000).toString(), true];
}

/**
 * 创建 GA4 Session Cookie
 * 用于在响应中设置 Cookie
 */
export function createSessionCookie(sessionId: string): string {
  // Cookie 有效期设置为 2 年（GA4 默认 Session 有效期很长）
  const maxAge = 2 * 365 * 24 * 60 * 60;
  return `ga_session_id=${sessionId}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax`;
}

/**
 * GA4 事件发送结果
 */
interface TrackEventResult {
  /** Session ID */
  sessionId: string;
  /** 是否需要设置 Cookie */
  needsSetCookie: boolean;
}

/**
 * 发送 GA4 事件（服务端）
 * @param eventName 事件名称
 * @param params 事件参数
 * @param request NextRequest 对象（用于提取上下文信息）
 * @returns Session ID 和是否需要设置 Cookie 的标志
 */
export async function trackEvent(
  eventName: string,
  params: Record<string, string | number | boolean | undefined>,
  request: NextRequest
): Promise<TrackEventResult> {
  // 获取 GA4 配置
  const config = await getAnalyticsConfig();

  // 如果未配置 GA4，直接返回
  if (!config.measurementId || !config.apiSecret) {
    console.log(`⚠️ GA4 未配置，跳过事件: ${eventName}`);
    const [sessionId, needsSetCookie] = extractSessionId(request);
    return { sessionId, needsSetCookie };
  }

  const [sessionId, needsSetCookie] = extractSessionId(request);

  try {
    // 构建 GA4 事件负载（符合 Measurement Protocol v2 规范）
    const payload = {
      client_id: sessionId,
      events: [
        {
          name: eventName,
          params: {
            ...params,
            engagement_time_msec: 100,
            session_id: sessionId,
          },
        },
      ],
    };

    // 发送到 GA4 Measurement Protocol
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${config.measurementId}&api_secret=${config.apiSecret}`;

    const response = await proxyFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ GA4 事件发送失败:', errorText);
      console.error('请求 URL:', url);
      console.error('请求 Payload:', JSON.stringify(payload, null, 2));
    } else {
      console.log(`✅ GA4 事件发送成功: ${eventName}`, params);
      // 开发环境下打印详细信息方便调试
      if (process.env.NODE_ENV === 'development') {
        console.log('GA4 Payload:', JSON.stringify(payload, null, 2));
      }
    }
  } catch (error) {
    console.error('❌ GA4 事件发送异常:', error);
    // 静默失败，不影响业务逻辑
  }

  return { sessionId, needsSetCookie };
}
