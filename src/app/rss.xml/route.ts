/**
 * RSS 2.0 订阅源
 * GET /rss.xml
 *
 * 文章筛选条件与 sitemap 保持一致，仅输出公开且未删除的文章。
 */

import { Feed } from 'feed';
import { getPrisma } from '@/lib/prisma';

const DEFAULT_SITE_URL = 'https://www.nnnnzs.cn';
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'NNNNzs';
const SITE_DESCRIPTION = 'Neon Nomad Navigating Night Zones';

/**
 * 强制动态生成，确保订阅源使用数据库中的最新文章数据。
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
}

function getArticleUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function parseCategories(category: string | null, tags: string | null) {
  const names = [category, ...(tags?.split(',') || [])]
    .map((name) => name?.trim())
    .filter((name): name is string => Boolean(name));

  return [...new Set(names)].map((name) => ({ name }));
}

export async function GET() {
  const baseUrl = getBaseUrl();
  const feedUrl = `${baseUrl}/rss.xml`;
  const prisma = await getPrisma();

  const posts = await prisma.tbPost.findMany({
    where: {
      hide: '0',
      is_delete: 0,
    },
    select: {
      path: true,
      title: true,
      description: true,
      category: true,
      tags: true,
      date: true,
      updated: true,
      cover: true,
    },
    orderBy: {
      date: 'desc',
    },
  });

  const latestUpdatedAt = posts.reduce<Date | undefined>((latest, post) => {
    const postUpdatedAt = post.updated || post.date;

    if (!postUpdatedAt || (latest && postUpdatedAt <= latest)) {
      return latest;
    }

    return postUpdatedAt;
  }, undefined);

  const feed = new Feed({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    id: baseUrl,
    link: baseUrl,
    language: 'zh-CN',
    updated: latestUpdatedAt,
    image: `${baseUrl}/favicon-light.png`,
    favicon: `${baseUrl}/favicon-light.png`,
    copyright: `Copyright © ${new Date().getFullYear()} ${SITE_NAME}`,
    feed: feedUrl,
    feedLinks: {
      rss: feedUrl,
    },
    author: {
      name: SITE_NAME,
      link: baseUrl,
    },
  });

  for (const post of posts) {
    if (!post.path || !post.title) {
      continue;
    }

    const articleUrl = getArticleUrl(baseUrl, post.path);

    feed.addItem({
      title: post.title,
      id: articleUrl,
      guid: articleUrl,
      link: articleUrl,
      description: post.description || undefined,
      date: post.updated || post.date || new Date(),
      published: post.date || undefined,
      category: parseCategories(post.category, post.tags),
      image: post.cover || undefined,
      author: [
        {
          name: SITE_NAME,
          link: baseUrl,
        },
      ],
    });
  }

  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600',
    },
  });
}
