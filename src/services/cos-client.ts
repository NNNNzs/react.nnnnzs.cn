/**
 * 腾讯云 COS 共享客户端
 * 统一提供 COS SDK 客户端实例与 Bucket 配置，避免在多个服务内重复实现。
 */

import type COS from 'cos-nodejs-sdk-v5';

type CosClient = InstanceType<typeof COS>;
type CosConstructor = new (options: { SecretId: string; SecretKey: string }) => CosClient;

/**
 * 获取 COS 客户端实例（动态加载 SDK，仅在 Node.js runtime 下可用）。
 */
export async function getCosClient(): Promise<CosClient> {
  const SecretId = process.env.SecretId || process.env.COS_SECRET_ID;
  const SecretKey = process.env.SecretKey || process.env.COS_SECRET_KEY;

  if (!SecretId || !SecretKey) {
    throw new Error('COS 配置缺失：SecretId 或 SecretKey');
  }

  const cosModuleName = 'cos-nodejs-sdk-v5';
  const { default: COSClient } = await import(cosModuleName) as { default: CosConstructor };
  return new COSClient({ SecretId, SecretKey });
}

/**
 * 读取 COS Bucket / Region / CDN 配置。
 */
export function getCosBucketConfig() {
  const Bucket = process.env.Bucket || process.env.COS_BUCKET;
  const Region = process.env.Region || process.env.COS_REGION;
  const CDN_URL = process.env.CDN_URL || process.env.COS_CDN_URL;

  if (!Bucket || !Region || !CDN_URL) {
    throw new Error('COS 配置缺失：Bucket、Region 或 CDN_URL');
  }

  return { Bucket, Region, CDN_URL };
}
