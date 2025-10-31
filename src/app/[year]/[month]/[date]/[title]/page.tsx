/**
 * 文章详情页
 * 路由: /[year]/[month]/[date]/[title]/
 * 匹配原版 Nuxt.js 的路由结构
 * 服务端渲染，支持 SEO
 */

import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Tag } from 'antd';
import { EyeOutlined, HeartOutlined, CalendarOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import dayjs from 'dayjs';
import 'highlight.js/styles/github-dark.min.css';
import { getPostRepository } from '@/lib/repositories';
import PostLikeButton from './PostLikeButton';
import PostVisitorTracker from './PostVisitorTracker';
import type { Post } from '@/types';

interface PageProps {
  params: Promise<{
    year: string;
    month: string;
    date: string;
    title: string;
  }> | {
    year: string;
    month: string;
    date: string;
    title: string;
  };
}

/**
 * 解析 params（支持 Promise 和普通对象）
 */
async function resolveParams(params: PageProps['params']) {
  if (params instanceof Promise) {
    return await params;
  }
  return params;
}

/**
 * 获取文章数据
 */
async function getPost(params: PageProps['params']): Promise<Post | null> {
  try {
    const resolvedParams = await resolveParams(params);
    const { year, month, date, title } = resolvedParams;
    
    // 安全解码 title，支持中文等特殊字符
    let decodedTitle: string;
    try {
      decodedTitle = decodeURIComponent(title);
    } catch {
      // 如果解码失败，使用原始值
      decodedTitle = title;
    }
    
    // 构建路径，尝试多种格式（兼容不同的存储方式）
    const path1 = `/${year}/${month}/${date}/${decodedTitle}`;
    const path2 = `/${year}/${month}/${date}/${decodedTitle}/`; // 带尾随斜杠
    const path3 = `/${year}/${month}/${date}/${title}`;
    const path4 = `/${year}/${month}/${date}/${title}/`; // 带尾随斜杠
    
    console.log('查找文章，参数:', { year, month, date, title, decodedTitle });
    console.log('尝试的路径:', { path1, path2, path3, path4 });
    
    const postRepository = await getPostRepository();
    
    // 尝试所有可能的路径格式
    const paths = [path1, path2, path3, path4];
    let post = null;
    
    for (const path of paths) {
      post = await postRepository.findOne({
        where: { path, is_delete: 0 },
      });
      if (post) {
        console.log(`✅ 通过路径找到文章: ${path}`);
        break;
      }
    }

    // 如果还没找到，尝试通过 title 查找（兼容旧数据）
    if (!post) {
      console.log('通过 path 未找到，尝试通过 title 查找');
      post = await postRepository.findOne({
        where: [
          { title: decodedTitle, is_delete: 0 },
          { oldTitle: decodedTitle, is_delete: 0 },
          { title, is_delete: 0 },
          { oldTitle: title, is_delete: 0 },
        ],
      });
    }

    if (post) {
      console.log('✅ 找到文章:', post.id, post.title, post.path);
    } else {
      console.log('❌ 未找到文章，查询条件:', { path1, path2, decodedTitle, title });
    }

    return post as Post | null;
  } catch (error) {
    console.error('❌ 获取文章详情失败:', error);
    // 如果是数据库连接错误，也记录详细信息
    if (error instanceof Error) {
      console.error('错误详情:', error.message, error.stack);
    }
    return null;
  }
}

/**
 * 生成 SEO Metadata
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await resolveParams(params);
  const post = await getPost(resolvedParams);

  if (!post) {
    return {
      title: '文章不存在',
    };
  }

  const description = post.description || 
    (post.content ? post.content.substring(0, 150).replace(/[#*`]/g, '') : '') ||
    `${post.title} - 文章详情`;

  const coverImages = post.cover ? [post.cover] : undefined;
  
  return {
    title: `${post.title} | 博客`,
    description,
    keywords: post.tags || undefined,
    openGraph: {
      title: post.title || undefined,
      description,
      type: 'article',
      publishedTime: post.date ? String(post.date) : undefined,
      modifiedTime: post.updated ? String(post.updated) : undefined,
      images: coverImages,
      tags: post.tags ? post.tags.split(',').map(t => t.trim()) : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title || undefined,
      description,
      images: coverImages,
    },
  };
}

/**
 * 页面组件（服务端渲染）
 */
export default async function PostDetail({ params }: PageProps) {
  try {
    // 解析 params
    const resolvedParams = await resolveParams(params);
    
    console.log('🔍 解析后的 params:', JSON.stringify(resolvedParams, null, 2));
    
    const post = await getPost(resolvedParams);

    if (!post) {
      console.log('❌ 文章不存在，调用 notFound()');
      notFound();
    }

    return (
    <>
      {/* 结构化数据（JSON-LD） */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.description || post.content?.substring(0, 200),
            image: post.cover,
            datePublished: post.date,
            dateModified: post.updated,
            author: {
              '@type': 'Person',
              name: 'nnnnzs',
            },
            publisher: {
              '@type': 'Organization',
              name: 'nnnnzs',
            },
            keywords: post.tags,
          }),
        }}
      />

      <article className="mx-auto max-w-4xl px-4 py-8">
        {/* 文章头部 */}
        <header className="mb-8 border-b pb-8">
          <h1 className="mb-4 text-4xl font-bold text-slate-950 dark:text-white">
            {post.title}
          </h1>
          
          {/* 元信息 */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center">
              <CalendarOutlined className="mr-1" />
              {dayjs(post.date).format('YYYY年MM月DD日')}
            </span>
            <span className="flex items-center">
              <EyeOutlined className="mr-1" />
              <PostVisitorTracker postId={post.id} initialCount={post.visitors || 0} />
            </span>
            <span className="flex items-center">
              <HeartOutlined className="mr-1" />
              {post.likes || 0} 人喜欢
            </span>
          </div>

          {/* 标签 */}
          {post.tags && (
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.split(',').map((tag, index) => (
                <Tag key={index} color="blue">
                  {tag.trim()}
                </Tag>
              ))}
            </div>
          )}
        </header>

        {/* 封面图 */}
        {post.cover && (
          <div className="relative mb-8 h-64 w-full overflow-hidden rounded-lg md:h-96">
            <Image
              src={post.cover}
              alt={post.title || ''}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 896px"
              priority
            />
          </div>
        )}

        {/* 文章内容 */}
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
          >
            {post.content || ''}
          </ReactMarkdown>
        </div>

        {/* 点赞按钮 */}
        <div className="mt-8 flex justify-center border-t pt-8">
          <PostLikeButton postId={post.id} initialLikes={post.likes || 0} />
        </div>
      </article>
    </>
    );
  } catch (error) {
    console.error('❌ 页面渲染失败:', error);
    if (error instanceof Error) {
      console.error('错误详情:', error.message, error.stack);
    }
    // 如果数据库连接失败，返回错误页面而不是404
    throw error;
  }
}

