/**
 * 合集中的文章项组件
 * 用于合集详情页展示文章列表
 */

"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import dayjs from "dayjs";
import type { ArticleInCollection } from "@/dto/collection.dto";

interface ArticleInCollectionItemProps {
  article: ArticleInCollection;
  index: number;
  className?: string;
}

export default function ArticleInCollectionItem({
  article,
  index,
  className = ""
}: ArticleInCollectionItemProps) {
  return (
    <Link
      href={article.path || `/post/${article.id}`}
      className={`block group ${className}`}
    >
      <div className="flex items-center gap-4 p-4 bg-white rounded-lg hover:shadow-md hover:bg-gray-50 transition-all dark:bg-slate-800 dark:hover:bg-slate-700">
        {/* 序号 */}
        <span className="text-2xl font-bold text-gray-400 group-hover:text-blue-600 w-8 text-center transition-colors dark:text-gray-500 dark:group-hover:text-blue-400">
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* 封面 */}
        {article.cover && (
          <div className="relative w-20 h-12 flex-shrink-0 overflow-hidden rounded">
            <Image
              src={article.cover}
              alt={article.title || ""}
              fill
              unoptimized={true}
              className="object-cover"
              sizes="80px"
            />
          </div>
        )}

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1 dark:text-white dark:group-hover:text-blue-400">
            {article.title}
          </h3>
          {article.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-1 dark:text-gray-400">
              {article.description}
            </p>
          )}
        </div>

        {/* 日期 */}
        <div className="text-sm text-gray-400 flex-shrink-0">
          {article.date ? dayjs(article.date).format("YYYY-MM-DD") : ""}
        </div>

        {/* 箭头 */}
        <div className="text-gray-300 group-hover:text-gray-600 dark:text-gray-600 dark:group-hover:text-gray-400">
          →
        </div>
      </div>
    </Link>
  );
}
