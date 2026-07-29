/** 合集详情页。 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import CollectionAmbientMedia from '@/components/collections/detail/CollectionAmbientMedia';
import CollectionArticleIndex from '@/components/collections/detail/CollectionArticleIndex';
import CollectionHero from '@/components/collections/detail/CollectionHero';
import { getCollectionBySlug } from '@/services/collection';
import { resolveCollectionVisual } from '@/lib/collection-visual';

const getCachedCollectionBySlug = unstable_cache(
  async (slug: string) => getCollectionBySlug(slug),
  ['collection'],
  {
    revalidate: 3600,
    tags: ['collection'],
  },
);

export const revalidate = 3600;

interface CollectionDetailPageProps {
  params: Promise<{ slug: string }>;
}

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://www.nnnnzs.cn';
}

function toAbsoluteUrl(path: string): string {
  return new URL(path, getSiteUrl()).toString();
}

export default async function CollectionDetailPage({ params }: CollectionDetailPageProps) {
  const { slug } = await params;
  const collection = await getCachedCollectionBySlug(slug);

  if (!collection) notFound();

  const { articles, ...serializedCollection } = collection;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: collection.title,
    description: collection.description || `${collection.title}文章合集`,
    url: toAbsoluteUrl(`/collections/${collection.slug}`),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: articles.length,
      itemListElement: articles.map((article, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: article.title,
        url: toAbsoluteUrl(article.path || `/post/${article.id}`),
      })),
    },
  };

  return (
    <main className="bg-[#eef1ef] text-slate-900 dark:bg-[#03080f] dark:text-slate-100">
      <div className="relative isolate overflow-hidden border-b border-slate-900/10 dark:border-cyan-100/10">
        <CollectionAmbientMedia
          cover={collection.cover}
          background={collection.background}
          color={collection.color}
          extends_json={collection.extends_json}
        />
        <CollectionHero
          collection={serializedCollection}
          firstArticlePath={articles[0]?.path || (articles[0] ? `/post/${articles[0].id}` : undefined)}
        />
      </div>
      <CollectionArticleIndex articles={articles} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
    </main>
  );
}

export async function generateMetadata({ params }: CollectionDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCachedCollectionBySlug(slug);

  if (!collection) return { title: '合集不存在' };

  const dayVisual = resolveCollectionVisual(collection, 'day');
  const description = collection.description || `${collection.title}文章合集，共 ${collection.article_count} 篇文章。`;

  return {
    title: `${collection.title} - 文章合集`,
    description,
    alternates: { canonical: toAbsoluteUrl(`/collections/${collection.slug}`) },
    openGraph: {
      type: 'website',
      title: collection.title,
      description,
      url: toAbsoluteUrl(`/collections/${collection.slug}`),
      images: dayVisual.coverImageUrl ? [{ url: dayVisual.coverImageUrl, alt: `${collection.title}合集封面` }] : undefined,
    },
  };
}
