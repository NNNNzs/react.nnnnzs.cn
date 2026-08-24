import type { MetadataRoute } from 'next';
import { getPrisma } from '@/lib/prisma';
import { getSiteUrl } from '@/lib/site-url';
import { meetsSeoAggregateThreshold } from '@/lib/seo-content';
import { INDEXABLE_POST_WHERE } from '@/lib/post-visibility';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const prisma = await getPrisma();
  const baseUrl = getSiteUrl();
  const [posts, collections] = await Promise.all([
    prisma.tbPost.findMany({
      where: INDEXABLE_POST_WHERE,
      select: { path: true, date: true, updated: true },
      orderBy: { date: 'desc' },
    }),
    prisma.tbCollection.findMany({
      where: { status: 1, is_delete: 0 },
      select: {
        slug: true,
        updated_at: true,
        collectionPosts: {
          where: { post: INDEXABLE_POST_WHERE },
          select: { post_id: true },
        },
      },
    }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/collections`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/about`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${baseUrl}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/notification-policy`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const postPages: MetadataRoute.Sitemap = posts
    .filter((post) => Boolean(post.path))
    .map((post) => ({
      url: `${baseUrl}${post.path}`,
      lastModified: post.updated || post.date || undefined,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    }));

  const collectionPages: MetadataRoute.Sitemap = collections
    .filter((collection) => meetsSeoAggregateThreshold(collection.collectionPosts.length))
    .map((collection) => ({
      url: `${baseUrl}/collections/${encodeURIComponent(collection.slug)}`,
      lastModified: collection.updated_at,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

  return [...staticPages, ...postPages, ...collectionPages];
}
