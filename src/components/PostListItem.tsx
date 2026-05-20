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
      className={`cyberpunk-post-item group relative m-auto my-8 flex w-full max-w-5xl flex-col overflow-hidden md:h-auto md:flex-row ${
        isEven ? "" : "md:flex-row-reverse"
      }`}
      id={`post_${post.id}`}
    >
      <div className="pointer-events-none absolute left-4 top-4 z-10 font-mono text-[11px] uppercase tracking-[0.22em] text-sky-900/45 dark:text-cyan-100/45 md:left-5 md:top-5">
        LOG {String(index + 1).padStart(2, "0")}
      </div>

      {/* 封面图片 - 2/5 */}
      <div className="relative h-64 overflow-hidden md:h-auto md:w-2/5">
        <Link href={post.path || "#"} prefetch={false}>
          <div className="relative w-full h-full">
            {post.cover ? (
              <Image
                src={optimizeImageUrl(post.cover, ImageOptimizationType.POST_LIST_COVER)}
                alt={post.title || ""}
                unoptimized={true}
                title={post.cover || ""}
                fill
                className="object-cover saturate-[0.85] transition-transform duration-700 group-hover:scale-105 group-hover:saturate-110"
                sizes="(max-width: 768px) 100vw, 40vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-slate-100 dark:bg-[#080b17]">
                <span className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-600">暂无封面</span>
              </div>
            )}
          </div>
        </Link>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),transparent_38%,rgba(236,72,153,0.10))] dark:bg-[linear-gradient(135deg,rgba(0,240,255,0.18),transparent_38%,rgba(255,0,102,0.18))]" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-black/10 md:bg-gradient-to-r dark:from-[#050611] dark:to-black/20" />
      </div>

      {/* 文章信息 - 3/5 */}
      <div className="flex min-h-[320px] flex-col justify-between p-6 md:w-3/5 md:p-8">
        <div>
          {/* 时间 */}
          <div className="mb-3 flex items-center gap-3 font-mono text-xs font-medium uppercase tracking-[0.18em] text-sky-800/55 dark:text-cyan-100/45">
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
              className="text-text-main-light transition-colors group-hover:text-sky-700 dark:text-slate-100 dark:group-hover:text-cyan-100"
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
            <p className="mb-4 line-clamp-3 text-sm leading-7 text-text-muted-light dark:text-slate-400">
              {post.description}
            </p>
          )}
        </div>

        {/* 底部元信息 */}
        <div className="mt-auto flex items-center gap-4 border-t border-sky-500/12 pt-4 text-xs text-text-muted-light dark:border-cyan-300/12 dark:text-slate-500">
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
