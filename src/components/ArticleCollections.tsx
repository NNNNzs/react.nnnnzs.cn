/**
 * 文章所属合集展示组件
 * 用于文章详情页显示所属合集
 */

"use client";

import React from "react";
import Link from "next/link";
import { BookOutlined } from "@ant-design/icons";
import type { PostCollectionInfo } from "@/dto/collection.dto";

interface ArticleCollectionsProps {
  collections: PostCollectionInfo[];
  className?: string;
}

export default function ArticleCollections({
  collections,
  className = ""
}: ArticleCollectionsProps) {
  if (!collections || collections.length === 0) {
    return null;
  }

  return (
    <div className={`mb-6 p-4 bg-blue-50 rounded-lg dark:bg-blue-900/20 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <BookOutlined className="text-blue-600 dark:text-blue-400" />
        <span className="font-semibold text-gray-900 dark:text-white">所属合集</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {collections.map((collection) => (
          <Link
            key={collection.id}
            href={`/collections/${collection.slug}`}
            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors dark:bg-blue-800/40 dark:text-blue-300 dark:hover:bg-blue-800/60"
            style={{
              backgroundColor: collection.color ? `${collection.color}20` : undefined,
              color: collection.color || undefined,
            }}
          >
            {collection.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
