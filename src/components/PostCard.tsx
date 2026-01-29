/**
 * 文章卡片组件
 */

"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import dayjs from "dayjs";
import { EyeOutlined, HeartOutlined, TagOutlined } from "@ant-design/icons";
import type { Post } from "@/types";
import { optimizeImageUrl, ImageOptimizationType } from "@/lib/image";

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  return (
    <article className="group overflow-hidden rounded-lg bg-white shadow-sm transition-all hover:shadow-md dark:bg-slate-800">
      <Link href={post.path || `/post/${post.id}`}>
        {/* 封面图片 */}
        <div className="relative h-48 w-full overflow-hidden bg-slate-200 dark:bg-slate-700">
          {post.cover ? (
            <Image
              src={optimizeImageUrl(post.cover, ImageOptimizationType.POST_CARD_COVER)}
              alt={post.title as string}
              fill
              unoptimized={true}
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              暂无封面
            </div>
          )}
        </div>

        {/* 文章信息 */}
        <div className="p-6">
          {/* 标题 */}
          <h2 className="mb-2 text-xl font-bold text-slate-900 line-clamp-2 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
            {post.title}
          </h2>

          {/* 描述 */}
          <p className="mb-4 text-sm text-slate-600 line-clamp-3 dark:text-slate-400">
            {post.description}
          </p>

          {/* 标签 */}
          {post.tags && Array.isArray(post.tags) && post.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {post.tags.map((tag: string, index: number) => (
                <span
                  key={index}
                  className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                >
                  <TagOutlined className="mr-1" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* 元信息 */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <time dateTime={String(post.date)}>
              {dayjs(post.date).format("YYYY-MM-DD")}
            </time>
            <div className="flex items-center space-x-4">
              <span className="flex items-center">
                <EyeOutlined className="mr-1" />
                {post.visitors || 0}
              </span>
              <span className="flex items-center">
                <HeartOutlined className="mr-1" />
                {post.likes || 0}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
