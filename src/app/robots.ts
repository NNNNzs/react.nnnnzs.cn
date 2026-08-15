/**
 * Robots.txt 生成
 * Next.js 16 App Router 会自动识别此文件并生成 /robots.txt
 * 
 * 配置搜索引擎爬虫的访问规则
 */

import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

/**
 * 生成 robots.txt
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/c/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

