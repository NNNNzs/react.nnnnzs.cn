/**
 * 开放平台工具函数
 * 用于调用开放平台 API 和验证签名
 */

import crypto from 'crypto';
import { getPrisma } from './prisma';

/**
 * 开放平台配置类型
 */
interface OpenPlatformConfig {
  appKey: string;
  appSecret: string;
  apiUrl: string;
}

type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike | undefined };

/**
 * 生成请求签名
 * 签名字符串 = HTTP方法 + "\n" + 请求路径 + "\n" + 时间戳 + "\n" + 请求体JSON
 * 签名值 = HMAC-SHA256(签名字符串, appSecret)
 */
export function generateSignature(
  method: string,
  path: string,
  timestamp: string,
  body: JsonLike | undefined,
  appSecret: string
): string {
  const bodyStr = body ? JSON.stringify(body) : '';
  const signString = `${method}\n${path}\n${timestamp}\n${bodyStr}`;

  console.log('[签名调试]', {
    method,
    path,
    timestamp,
    bodyStr: bodyStr || '(空)',
    signString,
    appSecretLength: appSecret.length,
    signaturePreview: crypto.createHmac('sha256', appSecret).update(signString).digest('hex').substring(0, 20) + '...',
  });

  return crypto
    .createHmac('sha256', appSecret)
    .update(signString)
    .digest('hex');
}

/**
 * 验证回调签名
 */
export function verifyCallback(
  bodyStr: string,
  appSecret: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(bodyStr)
    .digest('hex');
  return expected === signature;
}

/**
 * 获取开放平台配置
 */
export async function getOpenPlatformConfig(): Promise<OpenPlatformConfig> {
  const prisma = await getPrisma();
  const configs = await prisma.tbConfig.findMany({
    where: {
      key: {
        in: [
          'OPEN_PLATFORM_APP_KEY',
          'OPEN_PLATFORM_APP_SECRET',
          'OPEN_PLATFORM_API_URL',
        ],
      },
      status: 1,
    },
  });

  const configMap = Object.fromEntries(
    configs.map((c) => [c.key, c.value])
  );

  return {
    appKey: configMap.OPEN_PLATFORM_APP_KEY || '',
    appSecret: configMap.OPEN_PLATFORM_APP_SECRET || '',
    apiUrl: configMap.OPEN_PLATFORM_API_URL || 'https://api.nnnnzs.cn',
  };
}

/**
 * 调用开放平台 API
 */
export async function callOpenPlatformAPI<T = unknown>(
  path: string,
  method: string = 'POST',
  body?: JsonLike
): Promise<T> {
  const { appKey, appSecret, apiUrl } = await getOpenPlatformConfig();

  console.log('[开放平台] 调用配置:', {
    path,
    method,
    appKey,
    appSecret: appSecret ? `${appSecret.substring(0, 10)}...` : 'undefined',
    apiUrl,
  });

  const timestamp = Math.floor(Date.now() / 1000).toString();
  // 签名时使用不包含 query 参数的路径
  const fullPath = `/open-platform${path}`;
  const pathForSignature = fullPath.split('?')[0]; // 去掉 query 参数
  const signature = generateSignature(method, pathForSignature, timestamp, body, appSecret);

  console.log('[开放平台] 签名信息:', {
    timestamp,
    fullPath,
    pathForSignature,
    signature: signature.substring(0, 20) + '...',
  });

  const url = `${apiUrl}${fullPath}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-App-Key': appKey,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  console.log('[开放平台] 响应状态:', {
    status: response.status,
    statusText: response.statusText,
  });

  if (!response.ok) {
    // 尝试读取错误响应体
    let errorText = '';
    try {
      const errorData = await response.json();
      errorText = JSON.stringify(errorData);
    } catch {
      errorText = await response.text();
    }
    console.error('[开放平台] 错误响应:', errorText);
    throw new Error(`开放平台 API 调用失败: ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  if (!result.status) {
    throw new Error(result.msg || '开放平台 API 调用失败');
  }

  return result.data;
}
