'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { CollectionShowcaseItem } from '@/dto/collection.dto';
import type { CollectionHomeVisualConfig } from '@/services/collection-home-visual';
import { collectionsCopy } from '@/config/site-copy/collections';
import { resolveCollectionVisual } from '@/lib/collection-visual';
import { selectStyleText } from '@/lib/site-style/copy';
import { useStyleVariant } from '@/lib/site-style/useStyleVariant';
import { ImageOptimizationType, optimizeImageUrl } from '@/lib/image';
import CollectionCoverMedia from './CollectionCoverMedia';
import { collectionMotion } from './collection-motion';

interface CollectionsShowcaseProps {
  collections: CollectionShowcaseItem[];
  homeVisual: CollectionHomeVisualConfig;
}

function FileGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.6">
      <path d="M6.5 3.75h7l4 4v12.5h-11z" />
      <path d="M13.5 3.75v4h4M9 12h6M9 15.5h4.5" />
    </svg>
  );
}

function ClockGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.6">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5v5l3.25 2" />
    </svg>
  );
}

function ArrowGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path d="m7 9 5 5 5-5" />
    </svg>
  );
}

function CarouselArrowGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.8">
      <path d="m7 9 5 5 5-5" />
    </svg>
  );
}

function formatCompactDate(value: string | null | undefined) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function formatLongDate(value: string | null | undefined) {
  if (!value) return '持续整理';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function getLatestArticleDate(collection: CollectionShowcaseItem) {
  let latest: string | null = null;
  let latestTime = 0;

  for (const article of collection.articles) {
    const value = article.updated || article.date;
    const time = value ? new Date(value).getTime() : 0;
    if (time > latestTime) {
      latest = value;
      latestTime = time;
    }
  }

  return latest;
}

/** 日夜背景是空间环境，档案面板仍承担主要的信息对比度。 */
function CollectionHomeBackground({ homeVisual }: Pick<CollectionsShowcaseProps, 'homeVisual'>) {
  const dayBackground = homeVisual.day || homeVisual.night;
  const nightBackground = homeVisual.night || homeVisual.day;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {dayBackground ? (
        <div
          className="absolute inset-0 bg-cover bg-center dark:hidden"
          style={{
            backgroundImage: `url(${optimizeImageUrl(dayBackground, ImageOptimizationType.COLLECTION_BACKGROUND)})`,
          }}
        />
      ) : null}
      {nightBackground ? (
        <div
          className="absolute inset-0 hidden bg-cover bg-center dark:block"
          style={{
            backgroundImage: `url(${optimizeImageUrl(nightBackground, ImageOptimizationType.COLLECTION_BACKGROUND)})`,
          }}
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-[#cdbf9f]/14 dark:from-[#020812]/5 dark:via-[#020812]/10 dark:to-[#020812]/38" />
      <div className="absolute inset-0 hidden opacity-[0.12] [background-image:linear-gradient(rgba(80,225,240,0.18)_1px,transparent_1px)] [background-size:100%_4px] dark:block" />
    </div>
  );
}

export default function CollectionsShowcase({ collections, homeVisual }: CollectionsShowcaseProps) {
  const variant = useStyleVariant();
  const shouldReduceMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState<number | null>(() => collections[0]?.id ?? null);
  const carouselViewportRef = useRef<HTMLDivElement>(null);
  const carouselItemRefs = useRef(new Map<number, HTMLAnchorElement>());
  const previousSelectedIndexRef = useRef(0);

  const visuals = useMemo(
    () => new Map(collections.map((collection) => [
      collection.id,
      resolveCollectionVisual(collection, variant),
    ])),
    [collections, variant],
  );
  const selected = useMemo(
    () => collections.find((collection) => collection.id === selectedId) || collections[0],
    [collections, selectedId],
  );
  const selectedIndex = selected
    ? collections.findIndex((collection) => collection.id === selected.id)
    : -1;

  useEffect(() => {
    if (!selected) return;

    const viewport = carouselViewportRef.current;
    const item = carouselItemRefs.current.get(selected.id);
    if (!viewport || !item) return;

    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    const viewportRect = viewport.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const isMovingBackward = selectedIndex < previousSelectedIndexRef.current;
    viewport.scrollTo({
      left: isDesktop
        ? 0
        : viewport.scrollLeft + (
          isMovingBackward
            ? itemRect.right - viewportRect.right
            : itemRect.left - viewportRect.left
        ),
      top: isDesktop
        ? viewport.scrollTop + (
          isMovingBackward
            ? itemRect.bottom - viewportRect.bottom
            : itemRect.top - viewportRect.top
        )
        : 0,
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
    });
    previousSelectedIndexRef.current = selectedIndex;
  }, [selected, selectedIndex, shouldReduceMotion]);

  const selectByIndex = (index: number) => {
    const collection = collections[index];
    if (collection) setSelectedId(collection.id);
  };

  if (!selected) {
    return (
      <main className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[#e8e1d3] dark:bg-[#020812]">
        <CollectionHomeBackground homeVisual={homeVisual} />
        <div className="relative mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-5 text-slate-600 dark:text-slate-300">
          {selectStyleText(collectionsCopy.empty, variant)}
        </div>
      </main>
    );
  }

  const selectedVisual = visuals.get(selected.id) || resolveCollectionVisual(selected, variant);
  const latestDate = getLatestArticleDate(selected);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#e8e1d3] text-[#332f2b] dark:bg-[#020812] dark:text-slate-100 lg:h-[100dvh] lg:min-h-0">
      <CollectionHomeBackground homeVisual={homeVisual} />

      <div className="relative mx-auto max-w-[1540px] px-3 pb-4 pt-[calc(var(--header-height)+1rem)] sm:px-6 lg:h-full lg:px-8 lg:pb-3 lg:pt-[calc(var(--header-height)+0.75rem)] xl:px-10">
        <section className="overflow-hidden rounded-[26px] border border-white/80 bg-[#f8f3ea]/74 shadow-[0_30px_100px_-42px_rgba(61,48,34,0.52)] backdrop-blur-md dark:border-cyan-300/22 dark:bg-[#04111c]/78 dark:shadow-[0_30px_110px_-38px_rgba(0,184,215,0.28)] lg:flex lg:h-full lg:flex-col">
          <header className="flex shrink-0 items-start justify-between gap-6 border-b border-[#756c60]/14 px-5 py-4 dark:border-cyan-200/12 sm:px-8 lg:px-8 lg:py-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7f7467] dark:text-cyan-300/65">
                {selectStyleText(collectionsCopy.eyebrow, variant)} · {String(collections.length).padStart(2, '0')}
              </p>
              <h1 className="mt-1 font-serif text-3xl font-semibold tracking-[-0.035em] lg:text-[2rem]">
                {selectStyleText(collectionsCopy.title, variant)}
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[#756c60] dark:text-slate-300/68 sm:text-sm">
                {selectStyleText(collectionsCopy.description, variant)}
              </p>
            </div>
            <div className="hidden items-center gap-3 pt-1 font-mono text-[10px] tracking-[0.16em] text-[#807568] dark:flex dark:text-cyan-300/65 sm:flex">
              <span className="rounded-full border border-current/20 px-3 py-1.5">
                {variant === 'night' ? `SYNC ${String(selected.id).padStart(2, '0')} / ${String(collections.length).padStart(2, '0')}` : `${selected.article_count} 篇`}
              </span>
            </div>
          </header>

          <div className="grid gap-6 p-4 sm:p-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6 lg:p-5 xl:grid-cols-[250px_minmax(0,1fr)] xl:gap-8 xl:p-6">
            <aside aria-label={selectStyleText(collectionsCopy.shelfLabel, variant)} className="flex min-w-0 flex-col lg:min-h-0">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-xs font-medium tracking-[0.08em]">
                  {selectStyleText(collectionsCopy.shelfLabel, variant)}
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="上一个合集"
                    disabled={selectedIndex <= 0}
                    onClick={() => selectByIndex(selectedIndex - 1)}
                    className="grid h-7 w-7 place-items-center rounded-full border border-[#746b60]/18 bg-white/36 text-[#736a60] transition-colors hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-30 dark:border-cyan-200/16 dark:bg-cyan-300/[0.04] dark:text-cyan-200 dark:hover:bg-cyan-300/[0.1]"
                  >
                    <span className="rotate-180"><CarouselArrowGlyph /></span>
                  </button>
                  <span className="min-w-10 text-center font-mono text-[9px] tracking-[0.12em] text-[#8a8075] dark:text-cyan-300/52">
                    {String(selectedIndex + 1).padStart(2, '0')} / {String(collections.length).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    aria-label="下一个合集"
                    disabled={selectedIndex >= collections.length - 1}
                    onClick={() => selectByIndex(selectedIndex + 1)}
                    className="grid h-7 w-7 place-items-center rounded-full border border-[#746b60]/18 bg-white/36 text-[#736a60] transition-colors hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-30 dark:border-cyan-200/16 dark:bg-cyan-300/[0.04] dark:text-cyan-200 dark:hover:bg-cyan-300/[0.1]"
                  >
                    <CarouselArrowGlyph />
                  </button>
                </div>
              </div>

              <div
                ref={carouselViewportRef}
                className="min-h-[82px] overflow-x-auto overflow-y-hidden overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:overflow-y-auto"
              >
                <div className="flex gap-2 pb-1 lg:flex-col lg:pb-0">
                {collections.map((collection, index) => {
                  const isSelected = collection.id === selected.id;
                  const visual = visuals.get(collection.id) || resolveCollectionVisual(collection, variant);

                  return (
                    <motion.a
                      key={collection.id}
                      ref={(node) => {
                        if (node) carouselItemRefs.current.set(collection.id, node);
                        else carouselItemRefs.current.delete(collection.id);
                      }}
                      href={`/collections/${collection.slug}`}
                      aria-current={isSelected ? 'true' : undefined}
                      aria-label={`${collection.title}，${collection.article_count} 篇文章`}
                      onClick={(event) => {
                        if (!isSelected) {
                          event.preventDefault();
                          setSelectedId(collection.id);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== ' ') return;
                        event.preventDefault();
                        if (isSelected) {
                          window.location.assign(`/collections/${collection.slug}`);
                        } else {
                          setSelectedId(collection.id);
                        }
                      }}
                      layout={!shouldReduceMotion}
                      transition={shouldReduceMotion ? { duration: 0 } : collectionMotion.transition}
                      className={`group relative flex h-[82px] w-[220px] shrink-0 overflow-hidden border text-[#332f2b] outline-none transition-[border-color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-[#4a8fbd] focus-visible:ring-offset-2 motion-reduce:transition-none dark:text-slate-100 dark:focus-visible:ring-cyan-300 dark:focus-visible:ring-offset-[#04111c] lg:w-full ${
                        isSelected
                          ? 'border-[#4a8fbd]/70 bg-white/78 shadow-[0_12px_28px_-18px_rgba(40,82,112,0.75)] dark:border-cyan-300/70 dark:bg-cyan-300/[0.07] dark:shadow-[0_12px_34px_-18px_rgba(34,211,238,0.55)]'
                          : 'border-[#746b60]/18 bg-white/42 hover:border-[#4a8fbd]/45 hover:bg-white/65 dark:border-cyan-100/12 dark:bg-black/20 dark:hover:border-cyan-300/38 dark:hover:bg-cyan-300/[0.04]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="h-full w-1.5 shrink-0"
                        style={{ backgroundColor: visual.accentColor }}
                      />
                      <div className="flex min-w-0 flex-1 flex-col justify-between px-3 py-2.5">
                        <div>
                          <div className="font-mono text-[9px] tracking-[0.16em] text-[#8a8075] dark:text-cyan-300/45">
                            {String(index + 1).padStart(2, '0')}
                          </div>
                          <h3 className="mt-0.5 line-clamp-2 font-serif text-[14px] font-semibold leading-[1.2] tracking-[-0.02em]">
                            {collection.title}
                          </h3>
                        </div>
                        <span className="font-mono text-[10px] text-[#777066] dark:text-cyan-200/58">
                          {String(collection.article_count).padStart(2, '0')} {selectStyleText(collectionsCopy.articleUnit, variant)}
                        </span>
                      </div>
                      <div className="relative w-[66px] shrink-0 overflow-hidden border-l border-white/35 bg-[#d9d2c6] dark:border-cyan-100/10 dark:bg-slate-900">
                        {visual.coverImageUrl ? (
                          <Image
                            src={optimizeImageUrl(visual.coverImageUrl, ImageOptimizationType.SMALL_THUMBNAIL)}
                            alt=""
                            fill
                            unoptimized
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.035] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                            style={{ objectPosition: visual.objectPosition }}
                            sizes="66px"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-black/45" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-r from-black/12 to-transparent dark:from-black/38" />
                      </div>
                    </motion.a>
                  );
                })}
                </div>
              </div>
            </aside>

            <section aria-live="polite" className="min-w-0 lg:h-full lg:min-h-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.article
                  key={selected.id}
                  initial={shouldReduceMotion ? false : collectionMotion.expanded.initial}
                  animate={collectionMotion.expanded.animate}
                  exit={shouldReduceMotion ? undefined : collectionMotion.expanded.exit}
                  transition={shouldReduceMotion ? { duration: 0 } : collectionMotion.expanded.transition}
                  className="grid min-w-0 gap-6 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(220px,0.76fr)_minmax(330px,1.24fr)] lg:gap-6 xl:grid-cols-[minmax(250px,0.78fr)_minmax(360px,1.22fr)] xl:gap-8"
                >
                  <div className="mx-auto flex w-full max-w-[390px] items-center justify-center lg:h-full lg:min-h-0">
                    <div className="relative aspect-[9/16] w-full overflow-hidden border border-[#6b6258]/22 bg-[#d9d2c6] shadow-[0_30px_70px_-35px_rgba(52,44,35,0.8)] [clip-path:polygon(0_0,calc(100%_-_22px)_0,100%_22px,100%_100%,0_100%)] dark:border-cyan-200/42 dark:bg-slate-900 dark:shadow-[0_30px_80px_-34px_rgba(34,211,238,0.4)] lg:h-full lg:max-h-[650px] lg:w-auto lg:max-w-full">
                      <CollectionCoverMedia
                        visual={selectedVisual}
                        alt={`${selected.title}合集封面`}
                        priority
                        sizes="(max-width: 1280px) 390px, 30vw"
                      />
                      <div className="absolute inset-0 border-[5px] border-white/18 dark:border-cyan-200/10" />
                      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/16 to-transparent dark:from-cyan-200/8" />
                    </div>
                  </div>

                  <div className="relative flex min-w-0 flex-col border border-[#746b60]/18 bg-white/55 p-5 [clip-path:polygon(0_0,calc(100%_-_20px)_0,100%_20px,100%_100%,0_100%)] dark:border-cyan-200/18 dark:bg-black/28 sm:p-6 lg:h-full lg:min-h-0 xl:p-7">
                    <div className="shrink-0 border-b border-[#746b60]/16 pb-4 dark:border-cyan-200/14">
                      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#81776b] dark:text-cyan-300/58">
                        {selectStyleText(collectionsCopy.selectedLabel, variant)} · {String(selected.id).padStart(2, '0')}
                      </p>
                      <h2 className="mt-2 max-w-xl font-serif text-3xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-4xl xl:text-[2.65rem]">
                        {selected.title}
                      </h2>
                      <p className="mt-3 line-clamp-3 max-w-2xl text-sm leading-6 text-[#6f675d] dark:text-slate-300/70">
                        {selected.description || '这个合集正在整理它的策展说明，文章目录已经可以进入阅读。'}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] text-[#756e65] dark:text-cyan-100/58">
                        <span className="inline-flex items-center gap-2">
                          <FileGlyph />
                          {selected.article_count} {selectStyleText(collectionsCopy.articleUnit, variant)}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <ClockGlyph />
                          最近更新：{formatLongDate(latestDate)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex min-h-0 flex-1 flex-col">
                      <div className="mb-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-[#91877b] dark:text-cyan-300/42">
                        <span>{selectStyleText(collectionsCopy.directory, variant)}</span>
                        <span>{Math.min(selected.articles.length, 11)} / {selected.article_count}</span>
                      </div>
                      <ol className="min-h-0 flex-1 divide-y divide-[#746b60]/12 overflow-y-auto border-y border-[#746b60]/12 pr-1 [scrollbar-width:thin] dark:divide-cyan-200/10 dark:border-cyan-200/10">
                        {selected.articles.map((article, index) => (
                          <li key={article.id}>
                            <Link
                              href={article.path}
                              className="group/article grid grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-2 py-2 text-[12px] leading-5 text-[#554f48] transition-colors hover:text-[#2f719b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a8fbd] dark:text-slate-300/78 dark:hover:text-cyan-200 dark:focus-visible:ring-cyan-300"
                            >
                              <span className="font-mono text-[9px] text-[#9a9083] dark:text-cyan-300/42">
                                {String(index + 1).padStart(2, '0')}
                              </span>
                              <span className="truncate">{article.title || '未命名文章'}</span>
                              <span className="font-mono text-[9px] text-[#9a9083] dark:text-cyan-300/42">
                                {formatCompactDate(article.updated || article.date)}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className="mt-4 flex shrink-0 justify-end">
                      <Link
                        href={`/collections/${selected.slug}`}
                        className="inline-flex min-h-11 items-center gap-3 rounded-lg bg-[#3f86b3] px-6 py-2.5 text-sm font-medium text-white shadow-[0_12px_28px_-16px_rgba(41,107,150,0.85)] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#33779f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a8fbd] focus-visible:ring-offset-2 motion-reduce:transform-none dark:border dark:border-cyan-300/46 dark:bg-cyan-300/[0.08] dark:text-cyan-200 dark:shadow-[0_12px_30px_-16px_rgba(34,211,238,0.5)] dark:hover:bg-cyan-300/[0.14] dark:focus-visible:ring-cyan-300 dark:focus-visible:ring-offset-[#07131d]"
                      >
                        {selectStyleText(collectionsCopy.enter, variant)}
                        <ArrowGlyph />
                      </Link>
                    </div>
                  </div>
                </motion.article>
              </AnimatePresence>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
