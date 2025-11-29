import React from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import type { Archive } from '@/dto/post.dto';

interface ArchivesListProps {
  archives: Archive[];
}

export default function ArchivesList({ archives }: ArchivesListProps) {
  if (archives.length === 0) {
    return (
      <div className="flex justify-center py-12 text-slate-500">
        暂无归档
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4">
      {archives.map((archive) => (
        <div key={archive.year} className="relative mb-8 last:mb-0">
          {/* 年份节点 */}
          <div className="mb-6 flex items-center">
            <div className="z-10 text-2xl font-bold text-slate-800 dark:text-slate-100">
              {archive.year}
            </div>
            {/* 年份下的分割线效果，可选 */}
            <div className="ml-4 h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
          </div>

          {/* 文章列表 */}
          <div className="relative border-l-2 border-slate-200 pl-8 ml-2 dark:border-slate-700 space-y-8 pb-4">
            {archive.posts.map((post) => (
              <div key={post.id} className="relative flex items-center">
                {/* 时间点 */}
                <div className="absolute -left-[37px] h-4 w-4 rounded-full border-4 border-white bg-slate-300 dark:border-slate-900 dark:bg-slate-600" />
                
                <div className="flex flex-1 flex-col sm:flex-row sm:items-center">
                  <span className="mb-1 w-24 text-sm text-slate-500 sm:mb-0">
                    {dayjs(post.date).format('MM-DD')}
                  </span>
                  
                  <Link
                    href={post.path || '#'}
                    className="text-base font-medium text-slate-700 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
                  >
                    {post.title}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
