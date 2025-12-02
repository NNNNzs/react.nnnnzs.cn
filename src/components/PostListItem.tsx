/**
 * 文章列表项组件
 * 参考 nnnnzs.cn/components/Post/CardItem.vue 的设计
 */

'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dayjs from 'dayjs';
import { EyeOutlined, HeartOutlined, TagOutlined } from '@ant-design/icons';
import type { Post } from '@/types';

interface PostListItemProps {
  post: Post;
}
const target = '';

export default function PostListItem({ post }: PostListItemProps) {
  return (
    <li
      className="post group m-auto my-8 flex w-5/6 max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-md transition-all hover:shadow-2xl dark:bg-slate-800 md:h-auto md:flex-row md:even:flex-row-reverse"
      id={`post_${post.id}`}
    >
      {/* 封面图片 */}
      <div className="post-cover w-full bg-transparent text-center md:w-3/5">
        <Link href={post.path || '#'} target='_blank'>
          <div className="relative h-48 w-full md:h-full md:max-h-96">
            {post.cover ? (
              <Image
                src={post.cover}
                alt={post.title || ''}
                title={post.cover || ''}
                fill
                className="rounded-t-xl object-cover transition-all md:rounded-2xl md:hover:shadow-2xl md:group-even:rounded-l-none md:group-odd:rounded-r-none"
                sizes="(max-width: 768px) 100vw, 60vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-slate-200 dark:bg-slate-700">
                <span className="text-slate-400">暂无封面</span>
              </div>
            )}
          </div>
        </Link>
      </div>

      {/* 文章信息 */}
      <div className="post-text w-full border-t-0 bg-white p-4 text-left dark:border-none dark:bg-slate-800 md:relative md:w-2/5 md:border md:border-gray-300 md:even:border-l-0 md:odd:border-r-0 lg:even:border-l-0 lg:odd:border-r-0">
        {/* 时间 */}
        <p className="post-time text-gray-300">
          {dayjs(post.date).format('YYYY-MM-DD')}
        </p>

        {/* 标题 */}
        <h2 className="post-title my-4 bg-white text-2xl text-slate-950 dark:bg-slate-800 dark:text-white md:line-clamp-1">
          <Link
            href={post.path || '#'}
            className="hover:text-blue-600"
            title={post.title || ''}
            target={target}
          >
            {post.title}
          </Link>
        </h2>

        {/* 标签 */}
        {post.tags && (
          <div className="post-tags mb-4 flex flex-wrap gap-2">
            {post.tags.split(',').map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              >
                <TagOutlined className="mr-1" />
                {tag.trim()}
              </span>
            ))}
          </div>
        )}

        {/* 描述 */}
        <p className="post-description hidden h-44 leading-10 text-gray-500 md:block">
          {post.description}
        </p>

        {/* 元信息 */}
        <p className="post-meta hidden text-slate-700 dark:text-slate-400 md:block">
          <span className="leancloud_visitors my-6 mr-4">
            <EyeOutlined className="mr-1" />
            热度
            <i className="ml-1 not-italic">{post.visitors || 0}</i>
          </span>

          <span className="leancloud_likes">
            <HeartOutlined className="mr-1" />
            喜欢
            <i className="ml-1 not-italic">{post.likes || 0}</i>
          </span>
        </p>
      </div>
    </li>
  );
}

