/**
 * 文件上传服务
 * 将文件 Buffer 上传到腾讯云 COS，返回 CDN URL。
 */

import { createHash } from 'crypto';
import { extname } from 'path';
import COS from 'cos-nodejs-sdk-v5';

function getCosClient() {
  const SecretId = process.env.SecretId || process.env.COS_SECRET_ID;
  const SecretKey = process.env.SecretKey || process.env.COS_SECRET_KEY;

  if (!SecretId || !SecretKey) {
    throw new Error('COS 配置缺失：SecretId 或 SecretKey');
  }

  return new COS({
    SecretId,
    SecretKey,
  });
}

function getCosBucketConfig() {
  const Bucket = process.env.Bucket || process.env.COS_BUCKET;
  const Region = process.env.Region || process.env.COS_REGION;
  const CDN_URL = process.env.CDN_URL || process.env.COS_CDN_URL;

  if (!Bucket || !Region || !CDN_URL) {
    throw new Error('COS 配置缺失：Bucket、Region 或 CDN_URL');
  }

  return { Bucket, Region, CDN_URL };
}

function normalizeExt(filename: string, ext?: string) {
  const rawExt = ext || extname(filename) || '.bin';
  return rawExt.startsWith('.') ? rawExt : `.${rawExt}`;
}

export function normalizeCosKey(key: string): string {
  const rawKey = key.trim();
  if (!rawKey) {
    throw new Error('COS Key 不能为空');
  }

  if (rawKey.includes('\\') || rawKey.includes('\0')) {
    throw new Error('COS Key 包含非法字符');
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rawKey)) {
    throw new Error('COS Key 应为对象路径，不能是完整 URL');
  }

  const segments = rawKey
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean);

  if (segments.length === 0) {
    throw new Error('COS Key 不能为空');
  }

  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('COS Key 不能包含相对路径');
  }

  const normalizedKey = `/${segments.join('/')}`;

  // 长度限制（cos_key 字段 VarChar(255)）
  if (normalizedKey.length > 250) {
    throw new Error(`COS Key 长度不能超过 250 字符（当前 ${normalizedKey.length}）`);
  }

  return normalizedKey;
}

export function getCdnUrlForCosKey(key: string): string {
  const { CDN_URL } = getCosBucketConfig();
  return `${CDN_URL.replace(/\/+$/, '')}${normalizeCosKey(key)}`;
}

export interface UploadFileInput {
  buffer: Buffer;
  filename: string;
  mimetype?: string;
  ext?: string;
  key?: string;
}

/**
 * 上传文件到 COS。
 */
export async function uploadFileToCOS(file: UploadFileInput): Promise<string> {
  const { Bucket, Region, CDN_URL } = getCosBucketConfig();
  const cos = getCosClient();

  const ext = normalizeExt(file.filename, file.ext);
  const md5Name = createHash('md5')
    .update(file.buffer)
    .digest('hex');
  const Key = file.key ? normalizeCosKey(file.key) : `/upload/${md5Name}${ext}`;

  const result = await cos.putObject({
    Bucket,
    Region,
    Key,
    Body: file.buffer,
    ContentType: file.mimetype,
    'x-cos-meta-filename': encodeURIComponent(file.filename),
  });

  if (result.statusCode === 200) {
    return `${CDN_URL.replace(/\/+$/, '')}${Key}`;
  }

  throw new Error(`上传失败: ${result.statusCode}`);
}

export function base64ToBuffer(base64: string): Buffer {
  const normalized = base64.includes(',')
    ? base64.slice(base64.indexOf(',') + 1)
    : base64;

  return Buffer.from(normalized, 'base64');
}

export interface DownloadedFile {
  buffer: Buffer;
  filename: string;
  mimetype?: string;
}

function getFilenameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').filter(Boolean).pop();
    return filename ? decodeURIComponent(filename) : 'attachment.bin';
  } catch {
    return 'attachment.bin';
  }
}

/**
 * 从 URL 下载文件。
 */
export async function downloadFileFromUrl(url: string, filename?: string): Promise<DownloadedFile> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BlogBot/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`下载文件失败 (${response.status}): ${url.slice(0, 200)}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    filename: filename || getFilenameFromUrl(url),
    mimetype: response.headers.get('content-type') || undefined,
  };
}
