/**
 * 图片转存服务
 * 将远程图片下载后上传到腾讯云 COS，返回 CDN URL
 */

import COS from 'cos-nodejs-sdk-v5';
import { createHash } from 'crypto';
import { extname } from 'path';

/**
 * 初始化 COS 客户端
 */
function getCosClient() {
  const SecretId = process.env.SecretId || process.env.COS_SECRET_ID;
  const SecretKey = process.env.SecretKey || process.env.COS_SECRET_KEY;

  if (!SecretId || !SecretKey) {
    throw new Error('COS 配置缺失：SecretId 或 SecretKey');
  }

  return new COS({ SecretId, SecretKey });
}

/**
 * 从 URL 下载图片，返回 Buffer
 */
async function downloadImage(url: string): Promise<{ buffer: Buffer; ext: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BlogBot/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`下载图片失败 (${response.status}): ${url.slice(0, 200)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // 从 content-type 或 URL 推断扩展名
  const contentType = response.headers.get('content-type') || '';
  let ext = '.png';

  if (contentType.includes('jpeg') || contentType.includes('jpg')) {
    ext = '.jpg';
  } else if (contentType.includes('webp')) {
    ext = '.webp';
  } else if (contentType.includes('gif')) {
    ext = '.gif';
  } else {
    // 尝试从 URL 提取
    const urlExt = extname(url).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(urlExt)) {
      ext = urlExt;
    }
  }

  return { buffer, ext };
}

/**
 * 上传 Buffer 到 COS，返回 CDN URL
 */
async function uploadBufferToCOS(buffer: Buffer, ext: string): Promise<string> {
  const Bucket = process.env.Bucket || process.env.COS_BUCKET;
  const Region = process.env.Region || process.env.COS_REGION;
  const CDN_URL = process.env.CDN_URL || process.env.COS_CDN_URL;

  if (!Bucket || !Region || !CDN_URL) {
    throw new Error('COS 配置缺失：Bucket、Region 或 CDN_URL');
  }

  const cos = getCosClient();

  // 用内容 MD5 + 时间戳作为文件名，避免冲突
  const contentHash = createHash('md5').update(buffer).digest('hex').slice(0, 16);
  const timestamp = Date.now().toString(36);
  const Key = `/upload/img-${timestamp}-${contentHash}${ext}`;

  const result = await cos.putObject({
    Bucket,
    Region,
    Key,
    Body: buffer,
  });

  if (result.statusCode === 200) {
    return `${CDN_URL}${Key}`;
  } else {
    throw new Error(`上传到 COS 失败: ${result.statusCode}`);
  }
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

/**
 * 转存远程图片到 CDN
 * @param imageUrl 远程图片 URL
 * @returns CDN URL
 */
export async function proxyImageToCDN(imageUrl: string): Promise<string> {
  const { buffer, ext } = await downloadImage(imageUrl);
  const cdnUrl = await uploadBufferToCOS(buffer, ext);
  return cdnUrl;
}

/**
 * 转存 base64 图片到 CDN
 * @param base64Image 不带 data URL 前缀的 base64 图片数据
 * @param ext 图片扩展名，默认 .png
 * @returns CDN URL
 */
export async function proxyBase64ImageToCDN(base64Image: string, ext = '.png'): Promise<string> {
  const buffer = Buffer.from(base64Image, 'base64');
  return uploadBufferToCOS(buffer, ext);
}

/**
 * 删除 CDN URL 对应的 COS 对象
 * 仅删除当前 COS_CDN_URL 域名下的文件，避免误删第三方 URL。
 */
export async function deleteCdnImage(url: string): Promise<boolean> {
  const { Bucket, Region, CDN_URL } = getCosBucketConfig();
  const normalizedCdnUrl = CDN_URL.replace(/\/+$/, '');

  if (!url.startsWith(normalizedCdnUrl)) {
    return false;
  }

  const parsedUrl = new URL(url);
  const cdnPath = new URL(normalizedCdnUrl).pathname.replace(/\/+$/, '');
  const keyPath = parsedUrl.pathname.startsWith(cdnPath)
    ? parsedUrl.pathname.slice(cdnPath.length)
    : parsedUrl.pathname;
  const Key = keyPath.startsWith('/') ? keyPath : `/${keyPath}`;

  if (!Key || Key === '/') {
    return false;
  }

  const cos = getCosClient();
  const result = await cos.deleteObject({
    Bucket,
    Region,
    Key,
  });

  return result.statusCode === 204 || result.statusCode === 200;
}
