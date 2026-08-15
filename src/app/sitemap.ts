import type { MetadataRoute } from 'next';
import { getPrisma } from '@/lib/prisma';
import { meetsSeoAggregateThreshold } from '@/lib/seo-content';
import { getSiteUrl } from '@/lib/site-url';
import { getIndexableCategoryEntries } from '@/services/category';
import { getIndexableTagEntries } from '@/services/tag';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const prisma = await getPrisma();
  const baseUrl = getSiteUrl();
  const [posts, tags, categories, collections] = await Promise.all([
    prisma.tbPost.findMany({
      where: { hide: '0', is_delete: 0, seo_indexable: true },
      select: { path: true, date: true, updated: true },
      orderBy: { date: 'desc' },
    }),
    getIndexableTagEntries(),
    getIndexableCategoryEntries(),
    prisma.tbCollection.findMany({
      where: { status: 1, is_delete: 0 },
      select: {
        slug: true,
        updated_at: true,
        collectionPosts: {
          where: { post: { hide: '0', is_delete: 0, seo_indexable: true } },
          select: { post_id: true },
        },
      },
    }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/tags`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/categories`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/collections`, changeFrequency: 'weekly', priority: 0.8 },
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

  const tagPages: MetadataRoute.Sitemap = tags
    .filter((tag) => meetsSeoAggregateThreshold(tag.count))
    .map((tag) => ({
      url: `${baseUrl}/tags/${encodeURIComponent(tag.name)}`,
      lastModified: tag.lastModified || undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

  const categoryPages: MetadataRoute.Sitemap = categories
    .filter((category) => meetsSeoAggregateThreshold(category.count))
    .map((category) => ({
      url: `${baseUrl}/categories/${encodeURIComponent(category.name)}`,
      lastModified: category.lastModified || undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

  const collectionPages: MetadataRoute.Sitemap = collections
    .filter((collection) => meetsSeoAggregateThreshold(collection.collectionPosts.length))
    .map((collection) => ({
      url: `${baseUrl}/collections/${encodeURIComponent(collection.slug)}`,
      lastModified: collection.updated_at,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

  return [...staticPages, ...postPages, ...tagPages, ...categoryPages, ...collectionPages];
}
