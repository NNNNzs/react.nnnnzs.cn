import Image from 'next/image';
import Link from 'next/link';
import dayjs from 'dayjs';
import type { ArticleInCollection } from '@/dto/collection.dto';
import { optimizeImageUrl, ImageOptimizationType } from '@/lib/image';

interface CollectionArticleIndexProps {
  articles: ArticleInCollection[];
}

/** 服务端渲染的合集文章目录，确保无 JavaScript 时仍可完整阅读与抓取。 */
export default function CollectionArticleIndex({ articles }: CollectionArticleIndexProps) {
  return (
    <section aria-labelledby="collection-directory-title" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
      <header className="mb-8 flex items-end justify-between gap-6 border-b border-slate-900/15 pb-5 dark:border-cyan-100/15">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-cyan-300/65">
            Reading sequence
          </p>
          <h2 id="collection-directory-title" className="mt-3 font-serif text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            <span className="dark:hidden">档案目录</span>
            <span className="hidden dark:inline">日志目录</span>
          </h2>
        </div>
        <span className="font-mono text-xs text-slate-500">{String(articles.length).padStart(2, '0')} entries</span>
      </header>

      {articles.length ? (
        <ol className="divide-y divide-slate-900/10 border-b border-slate-900/15 dark:divide-cyan-100/10 dark:border-cyan-100/15">
          {articles.map((article, index) => (
            <li key={article.id}>
              <Link
                href={article.path || `/post/${article.id}`}
                className="group grid gap-4 py-6 outline-none transition-colors hover:bg-white/35 focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:bg-cyan-300/[0.025] sm:grid-cols-[56px_112px_minmax(0,1fr)_auto] sm:items-center sm:px-4"
              >
                <span className="font-mono text-sm text-slate-400 transition-colors group-hover:text-slate-900 dark:group-hover:text-cyan-300">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="relative hidden aspect-[16/10] overflow-hidden bg-slate-200 sm:block dark:bg-slate-900">
                  {article.cover ? (
                    <Image
                      src={optimizeImageUrl(article.cover, ImageOptimizationType.SMALL_THUMBNAIL)}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover opacity-85 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
                      sizes="112px"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-medium leading-7 transition-colors group-hover:text-cyan-800 dark:group-hover:text-cyan-300 sm:text-lg">
                    {article.title}
                  </h3>
                  {article.description ? (
                    <p className="mt-1 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">
                      {article.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 sm:justify-end">
                  {article.date ? <time dateTime={article.date}>{dayjs(article.date).format('YYYY.MM.DD')}</time> : null}
                  <span aria-hidden="true" className="text-lg transition-transform group-hover:translate-x-1">→</span>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="border border-dashed border-slate-900/20 px-6 py-16 text-center text-slate-500 dark:border-cyan-100/20 dark:text-slate-400">
          <span className="dark:hidden">这个合集还没有收录文章。</span>
          <span className="hidden dark:inline">当前节点尚未写入日志。</span>
        </div>
      )}
    </section>
  );
}
