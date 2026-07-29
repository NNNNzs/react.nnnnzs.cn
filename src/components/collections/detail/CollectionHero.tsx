'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import type { SerializedCollection } from '@/dto/collection.dto';
import { collectionsCopy } from '@/config/site-copy/collections';
import { resolveCollectionVisual } from '@/lib/collection-visual';
import { selectStyleText } from '@/lib/site-style/copy';
import { useStyleVariant } from '@/lib/site-style/useStyleVariant';
import CollectionCoverMedia from '@/components/collections/CollectionCoverMedia';

interface CollectionHeroProps {
  collection: SerializedCollection;
  firstArticlePath?: string | null;
}

/** 合集详情首屏：展开后的竖长封面与资料页。 */
export default function CollectionHero({ collection, firstArticlePath }: CollectionHeroProps) {
  const variant = useStyleVariant();
  const shouldReduceMotion = useReducedMotion();
  const visual = resolveCollectionVisual(collection, variant);
  const readingPath = collection.extends_json?.readingPath || [];

  return (
    <section className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-16 sm:px-8 lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.35fr)] lg:items-center lg:gap-16 lg:px-12 lg:pb-24 lg:pt-24">
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, x: -18, rotateY: -5 }}
        animate={{ opacity: 1, x: 0, rotateY: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto w-full max-w-[300px] lg:max-w-[340px]"
      >
        <div className="absolute -inset-5 translate-x-5 translate-y-6 border border-slate-900/10 bg-white/30 backdrop-blur-sm dark:border-cyan-200/10 dark:bg-cyan-300/[0.025]" />
        <div className="relative aspect-[9/16] overflow-hidden border border-white/50 bg-slate-300 shadow-[0_42px_90px_-42px_rgba(15,23,42,0.9)] dark:border-cyan-100/25 dark:bg-slate-900 dark:shadow-[0_45px_100px_-44px_rgba(34,211,238,0.45)]">
          <CollectionCoverMedia
            visual={visual}
            alt={`${collection.title}合集封面`}
            priority
            sizes="(max-width: 1024px) 300px, 340px"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-black/18 via-transparent to-white/15" />
          <span className="absolute inset-y-0 left-0 w-1 bg-black/20 shadow-[2px_0_6px_rgba(255,255,255,0.2)]" />
        </div>
      </motion.div>

      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.12, duration: 0.55 }}
        className="min-w-0 border-y border-slate-900/15 py-9 dark:border-cyan-100/15 lg:py-12"
      >
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-500 dark:text-cyan-300/70">
          {selectStyleText(collectionsCopy.detailEyebrow, variant)} · {String(collection.id).padStart(2, '0')}
        </div>
        <h1 className="mt-5 max-w-3xl font-serif text-4xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-7xl">
          {collection.title}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300/78">
          {collection.description || '这里收录围绕同一主题持续写下的文章。策展说明仍在整理，目录已经可以开始阅读。'}
        </p>

        {readingPath.length ? (
          <div className="mt-7 flex flex-wrap gap-2" aria-label="阅读线索">
            {readingPath.map((item) => (
              <span key={item} className="border border-slate-900/15 bg-white/35 px-3 py-1.5 text-xs text-slate-600 dark:border-cyan-100/15 dark:bg-cyan-300/[0.035] dark:text-slate-300">
                {item}
              </span>
            ))}
          </div>
        ) : null}

        <dl className="mt-9 grid grid-cols-3 gap-4 border-t border-slate-900/10 pt-6 dark:border-cyan-100/10">
          <div>
            <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Articles</dt>
            <dd className="mt-2 text-xl font-medium">{collection.article_count}</dd>
          </div>
          <div>
            <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Views</dt>
            <dd className="mt-2 text-xl font-medium">{collection.total_views.toLocaleString('zh-CN')}</dd>
          </div>
          <div>
            <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Likes</dt>
            <dd className="mt-2 text-xl font-medium">{collection.total_likes.toLocaleString('zh-CN')}</dd>
          </div>
        </dl>

        {firstArticlePath ? (
          <Link
            href={firstArticlePath}
            className="mt-9 inline-flex items-center gap-3 border-b border-current pb-1 text-sm font-medium transition-colors hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:text-cyan-300"
          >
            {selectStyleText(collectionsCopy.startReading, variant)}
            <span aria-hidden="true">↘</span>
          </Link>
        ) : null}
      </motion.div>
    </section>
  );
}
