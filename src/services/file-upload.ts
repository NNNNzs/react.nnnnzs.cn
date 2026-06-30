/**
 * 文件上传服务
 * 将文件 Buffer 上传到腾讯云 COS，返回 CDN URL。
 */

import { getCosClient, getCosBucketConfig } from './cos-client';

function getExtname(filename: string) {
  const cleanName = filename.split(/[?#]/, 1)[0] || '';
  const basename = cleanName.split('/').filter(Boolean).pop() || cleanName;
  const dotIndex = basename.lastIndexOf('.');
  return dotIndex > 0 ? basename.slice(dotIndex) : '';
}

function normalizeExt(filename: string, ext?: string) {
  const rawExt = ext || getExtname(filename) || '.bin';
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
  const cos = await getCosClient();
  const cryptoModuleName = 'crypto';
  const { createHash } = await import(cryptoModuleName) as typeof import('crypto');

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
