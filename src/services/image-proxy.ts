/**
 * 图片转存服务
 * 将远程图片下载后上传到腾讯云 COS，返回 CDN URL。
 */

import { getCosClient, getCosBucketConfig } from './cos-client';
import { uploadFileToCOS } from './file-upload';

function getExtnameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').filter(Boolean).pop() || '';
    const dotIndex = filename.lastIndexOf('.');
    return dotIndex > 0 ? filename.slice(dotIndex).toLowerCase() : '';
  } catch {
    return '';
  }
}

/**
 * 从 URL 下载图片，返回 Buffer。
 */
async function downloadImage(url: string): Promise<{ buffer: Buffer; ext: string; mimetype?: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BlogBot/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`下载图片失败 (${response.status}): ${url.slice(0, 200)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || '';
  let ext = '.png';

  if (contentType.includes('jpeg') || contentType.includes('jpg')) {
    ext = '.jpg';
  } else if (contentType.includes('webp')) {
    ext = '.webp';
  } else if (contentType.includes('gif')) {
    ext = '.gif';
  } else {
    const urlExt = getExtnameFromUrl(url);
    if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(urlExt)) {
      ext = urlExt;
    }
  }

  return {
    buffer,
    ext,
    mimetype: contentType || undefined,
  };
}

/**
 * 上传 Buffer 到 COS，返回 CDN URL。
 * 注意: filename 仅用于 uploadFileToCOS 接口兼容，实际 COS Key 由 options.key 决定。
 */
async function uploadBufferToCOS(
  buffer: Buffer,
  ext: string,
  options: { key?: string; mimetype?: string } = {},
): Promise<string> {
  return uploadFileToCOS({
    buffer,
    filename: options.key?.split('/').filter(Boolean).pop() || `image${ext}`,
    mimetype: options.mimetype,
    ext,
    key: options.key,
  });
}

/**
 * 转存远程图片到 CDN。
 * @param imageUrl 远程图片 URL
 * @returns CDN URL
 */
export async function proxyImageToCDN(
  imageUrl: string,
  options: { key?: string } = {},
): Promise<string> {
  const { buffer, ext, mimetype } = await downloadImage(imageUrl);
  return uploadBufferToCOS(buffer, ext, {
    key: options.key,
    mimetype,
  });
}

/**
 * 转存 base64 图片到 CDN。
 * @param base64Image 不带 data URL 前缀的 base64 图片数据
 * @param ext 图片扩展名，默认 .png
 * @returns CDN URL
 */
export async function proxyBase64ImageToCDN(
  base64Image: string,
  ext = '.png',
  options: { key?: string } = {},
): Promise<string> {
  const buffer = Buffer.from(base64Image, 'base64');
  return uploadBufferToCOS(buffer, ext, {
    key: options.key,
    mimetype: ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png',
  });
}

/**
 * 删除 CDN URL 对应的 COS 对象。
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

  const cos = await getCosClient();
  const result = await cos.deleteObject({
    Bucket,
    Region,
    Key,
  });

  return result.statusCode === 204 || result.statusCode === 200;
}
