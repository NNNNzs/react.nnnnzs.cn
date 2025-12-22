/**
 * Robots.txt 生成
 * Next.js 16 App Router 会自动识别此文件并生成 /robots.txt
 * 
 * 配置搜索引擎爬虫的访问规则
 */

import { MetadataRoute } from 'next';

/**
 * 获取网站基础 URL
 */
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  return 'https://www.nnnnzs.cn';
}

/**
 * 生成 robots.txt
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/c/',
          '/login',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

