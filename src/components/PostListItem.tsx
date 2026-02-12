/**
 * 文章列表项组件
 * 基于设计稿重构，保留一左一右交替布局
 */

"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import dayjs from "dayjs";
import { EyeOutlined, HeartOutlined } from "@ant-design/icons";
import type { Post } from "@/types";
import { optimizeImageUrl, ImageOptimizationType } from "@/lib/image";
import { getTagClassName } from "@/lib/tagColors";

interface PostListItemProps {
  post: Post;
  index?: number; // 用于判断奇偶行
}

function PostListItem({ post, index = 0 }: PostListItemProps) {
  // 判断是否为偶数行（从0开始，所以0,2,4...是偶数行）
  const isEven = index % 2 === 0;

  return (
    <li
      className={`group relative m-auto my-8 flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-card-light shadow-sm hover:shadow-xl dark:bg-card-dark md:h-auto md:flex-row border border-border-light dark:border-border-dark transition-all duration-300 transform hover:-translate-y-1 ${
        isEven ? "" : "md:flex-row-reverse"
      }`}
      id={`post_${post.id}`}
    >
      {/* 封面图片 - 2/5 */}
      <div className="md:w-2/5 h-64 md:h-auto overflow-hidden relative">
        <Link href={post.path || "#"} prefetch={false}>
          <div className="relative w-full h-full">
            {post.cover ? (
              <Image
                src={optimizeImageUrl(post.cover, ImageOptimizationType.POST_LIST_COVER)}
                alt={post.title || ""}
                unoptimized={true}
                title={post.cover || ""}
                fill
                className={`object-cover transition-transform duration-700 group-hover:scale-105 ${
                  isEven ? "md:rounded-l-2xl md:rounded-r-none" : "md:rounded-r-2xl md:rounded-l-none"
                } rounded-t-2xl md:rounded-t-none`}
                sizes="(max-width: 768px) 100vw, 40vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-slate-100 dark:bg-slate-900/50">
                <span className="text-slate-400 dark:text-slate-600">暂无封面</span>
              </div>
            )}
          </div>
        </Link>
        {/* 移动端渐变遮罩 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 md:hidden"></div>
      </div>

      {/* 文章信息 - 3/5 */}
      <div className="md:w-3/5 p-6 md:p-8 flex flex-col justify-between min-h-[320px]">
        <div>
          {/* 时间 */}
          <div className="flex items-center gap-3 text-xs font-medium text-text-muted-light dark:text-text-muted-dark mb-3">
            <time dateTime={post.date ?? undefined}>
              {dayjs(post.date).format("YYYY-MM-DD")}
            </time>
          </div>

          {/* 标题 */}
          <h2 className="text-xl md:text-2xl font-bold mb-3 text-text-main-light dark:text-text-main-dark group-hover:text-primary transition-colors line-clamp-2">
            <Link
              href={post.path || "#"}
              title={post.title || ""}
              prefetch={false}
            >
              {post.title}
            </Link>
          </h2>

          {/* 标签 */}
          {post.tags && Array.isArray(post.tags) && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map((tag: string, tagIndex: number) => (
                <span
                  key={tagIndex}
                  className={getTagClassName(tag)}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* 描述 */}
          {post.description && (
            <p className="text-text-muted-light dark:text-text-muted-dark text-sm leading-relaxed line-clamp-3 mb-4">
              {post.description}
            </p>
          )}
        </div>

        {/* 底部元信息 */}
        <div className="flex items-center gap-4 text-xs text-text-muted-light dark:text-text-muted-dark border-t border-border-light dark:border-border-dark pt-4 mt-auto">
          <span className="flex items-center gap-1">
            <EyeOutlined className="text-sm" />
            {post.visitors || 0}
          </span>
          <span className="flex items-center gap-1">
            <HeartOutlined className="text-sm" />
            {post.likes || 0}
          </span>
        </div>
      </div>
    </li>
  );
}

// 使用 React.memo 优化重渲染
export default React.memo(PostListItem);
