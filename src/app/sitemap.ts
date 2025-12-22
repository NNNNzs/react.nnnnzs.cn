/**
 * 站点地图生成
 * Next.js 16 App Router 会自动识别此文件并生成 /sitemap.xml
 * 
 * 包含的页面：
 * - 首页
 * - 所有文章详情页
 * - 标签列表和标签页
 * - 分类列表和分类页
 * - 归档页
 * - 时间线页
 */

import { MetadataRoute } from 'next';
import { getPrisma } from '@/lib/prisma';
import { getAllTags } from '@/services/tag';
import { getAllCategories } from '@/services/category';

/**
 * 获取网站基础 URL
 * 优先使用环境变量，否则使用默认值
 */
function getBaseUrl(): string {
  // 优先使用环境变量
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  
  // 生产环境默认值（根据项目名称推断）
  return 'https://www.nnnnzs.cn';
}

/**
 * 生成站点地图
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const prisma = await getPrisma();
  
  // 获取所有未删除且显示的文章
  const posts = await prisma.tbPost.findMany({
    where: {
      hide: '0',
      is_delete: 0,
    },
    select: {
      path: true,
      date: true,
      updated: true,
    },
    orderBy: {
      date: 'desc',
    },
  });

  // 获取所有标签
  const tags = await getAllTags();
  
  // 获取所有分类
  const categories = await getAllCategories();

  // 静态页面
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/tags`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/archives`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/timeline`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  // 文章详情页（过滤掉 path 为 null 的文章）
  const postPages: MetadataRoute.Sitemap = posts
    .filter((post) => post.path) // 过滤掉 path 为 null 的文章
    .map((post) => ({
      url: `${baseUrl}${post.path}`,
      lastModified: post.updated || post.date || new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    }));

  // 标签页
  const tagPages: MetadataRoute.Sitemap = tags.map(([tag]) => ({
    url: `${baseUrl}/tags/${encodeURIComponent(tag)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  // 分类页
  const categoryPages: MetadataRoute.Sitemap = categories.map(([category]) => ({
    url: `${baseUrl}/categories/${encodeURIComponent(category)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  // 合并所有页面
  return [...staticPages, ...postPages, ...tagPages, ...categoryPages];
}

