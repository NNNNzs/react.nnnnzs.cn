/**
 * 文章详情页
 * 路由: /[year]/[month]/[date]/[title]/
 * 匹配原版 Nuxt.js 的路由结构
 * 服务端渲染，支持 SEO
 */

import React, { cache, Suspense } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Tag } from "antd";
import {
  EyeOutlined,
  HeartOutlined,
  CalendarOutlined,
} from "@ant-design/icons";

import dayjs from "dayjs";
import { getPostList } from "@/services/post";

import { getCollectionsByPostId } from "@/services/collection";
import PostLikeButton from "./PostLikeButton";
import PostVisitorTracker from "./PostVisitorTracker";
import MarkdownPreview from "@/components/MarkdownPreview";
import CommentSection from "@/components/CommentSection";
import SetCurrentPost from "@/components/SetCurrentPost";
import PostVersionHistory from "@/components/PostVersionHistory";
import ArticleCollections from "@/components/ArticleCollections";
import type { Post } from "@/types";
import type { PostCollectionInfo } from "@/dto/collection.dto";

interface PageProps {
  params:
    | Promise<{
        year: string;
        month: string;
        date: string;
        title: string;
      }>
    | {
        year: string;
        month: string;
        date: string;
        title: string;
      };
}

/**
 * 解析 params（支持 Promise 和普通对象）
 */
async function resolveParams(params: PageProps["params"]) {
  if (params instanceof Promise) {
    return await params;
  }
  return params;
}

/**
 * 获取文章数据（使用 Next.js fetch 缓存 + 标签）
 * 支持按需重新验证 (On-Demand Revalidation)
 */
async function getPost(params: PageProps["params"]): Promise<Post | null> {
  try {
    const resolvedParams = await resolveParams(params);
    const { year, month, date, title } = resolvedParams;

    // 构建 API 路径
    // 服务器端需要完整的 URL，使用 next.config.ts 中配置的 baseUrl
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Next.js 传入的 title 是编码的（如 MCP-%E8%AE%A4...）
    // 我们需要先解码它，然后让 fetch 重新编码
    // 否则 fetch 会对已经编码的字符再次编码（% → %25），导致双重编码
    const decodedTitle = decodeURIComponent(title);
    const apiPath = `${baseUrl}/api/post/by-path/${year}/${month}/${date}/${decodedTitle}`;

    console.log("🔍 Fetch 缓存请求 - 文章路径:", apiPath);

    // 使用 fetch + Next.js 缓存标签
    const response = await fetch(apiPath, {
      // 声明缓存标签，与 API route 中的标签对应
      next: {
        tags: [`post`], // 通用标签，可批量清除所有文章缓存
        // 如果需要精确控制单篇文章，可以在获取到 post id 后添加特定标签
      },
    });

    if (!response.ok) {
      console.error("❌ API 请求失败:", response.status);
      return null;
    }

    const result = await response.json();

    if (!result.status) {
      console.error("❌ API 返回错误:", result.message);
      return null;
    }

    console.log("✅ API 返回成功，文章 ID:", result.data?.id);
    return result.data;
  } catch (error) {
    console.error("❌ 获取文章详情失败 client:", error);
    return null;
  }
}

/**
 * 获取文章所属合集
 * 使用 React cache 缓存
 */
const getPostCollections = cache(
  async (postId: number): Promise<PostCollectionInfo[]> => {
    try {
      return await getCollectionsByPostId(postId);
    } catch (error) {
      console.error("❌ 获取文章合集失败:", error);
      return [];
    }
  }
);

/**
 * 生成 SEO Metadata
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const resolvedParams = await resolveParams(params);
  const post = await getPost(resolvedParams);

  if (!post) {
    return {
      title: "文章不存在",
    };
  }

  const description =
    post.description ||
    (post.content
      ? post.content.substring(0, 150).replace(/[#*`]/g, "")
      : "") ||
    `${post.title} - 文章详情`;

  const coverImages = post.cover ? [post.cover] : undefined;

  return {
    title: `${post.title} | 博客`,
    description,
    keywords:
      Array.isArray(post.tags) && post.tags.length > 0
        ? post.tags.join(",")
        : undefined,
    openGraph: {
      title: post.title || undefined,
      description,
      type: "article",
      publishedTime: post.date ? String(post.date) : undefined,
      modifiedTime: post.updated ? String(post.updated) : undefined,
      images: coverImages,
      tags:
        Array.isArray(post.tags) && post.tags.length > 0
          ? post.tags
          : undefined,
    },
    twitter: {
      card: "summary_large_image",
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

    const post = await getPost(resolvedParams);

    if (!post) {
      // console.log("❌ 文章不存在，调用 notFound()");
      notFound();
    }

    // 获取文章所属合集
    const collections = await getPostCollections(post.id);

    return (
      <>
        {/* 将文章信息传递给 Header 组件 */}
        <SetCurrentPost post={post} />

        {/* 结构化数据（JSON-LD） */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: post.title,
              description: post.description || post.content?.substring(0, 200),
              image: post.cover,
              datePublished: post.date,
              dateModified: post.updated,
              author: {
                "@type": "Person",
                name: "nnnnzs",
              },
              publisher: {
                "@type": "Organization",
                name: "nnnnzs",
              },
              keywords:
                Array.isArray(post.tags) && post.tags.length > 0
                  ? post.tags.join(",")
                  : undefined,
            }),
          }}
        />

        <article className="mx-auto max-w-4xl px-4 py-8 relative">
          {/* 文章头部 */}
          <header className="mb-8 border-b pb-8">
            <h1 className="mb-4 text-4xl font-bold text-slate-950 dark:text-white">
              {post.title}
            </h1>

            {/* 元信息 */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center">
                <CalendarOutlined className="mr-1" />
                {dayjs(post.date).format("YYYY年MM月DD日")}
              </span>
              <span className="flex items-center">
                <EyeOutlined className="mr-1" />
                <PostVisitorTracker
                  postId={post.id}
                  initialCount={post.visitors || 0}
                />
              </span>
              <span className="flex items-center">
                <HeartOutlined className="mr-1" />
                {post.likes || 0} 人喜欢
              </span>
            </div>

            {/* 标签 */}
            {Array.isArray(post.tags) && post.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.map((tag, index) => (
                  <Tag key={index} color="blue">
                    {tag}
                  </Tag>
                ))}
              </div>
            )}
          </header>

          {/* 所属合集 */}
          {collections && collections.length > 0 && (
            <ArticleCollections collections={collections} />
          )}

          {/* 文章内容 */}
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <MarkdownPreview
              showMdCatalog={true}
              content={post.content || ""}
            />
          </div>

          {/* 点赞按钮和版本历史 */}
          <div className="mt-8 flex items-center justify-center gap-4 border-t pt-8">
            <PostLikeButton postId={post.id} initialLikes={post.likes || 0} />
            <PostVersionHistory postId={post.id} />
          </div>
        </article>

        {/* 评论区 */}
        <div className="mt-12 px-4">
          <Suspense
            fallback={
              <div className="text-center py-8 text-slate-500">
                加载评论中...
              </div>
            }
          >
            <CommentSection postId={post.id} />
          </Suspense>
        </div>
      </>
    );
  } catch (error) {
    console.error("❌ 页面渲染失败:", error);
    // 如果数据库连接失败，返回错误页面而不是404
    throw error;
  }
}

export async function generateStaticParams() {
  const { record } = await getPostList({ pageNum: 1, pageSize: 10000 }); // DB 查 path

  return record.map((post) => {
    const [, year, month, date, title] = post.path!.split("/");

    return {
      year,
      month,
      date,
      title: title,
    };
  });
}

// 使用 Next.js fetch 缓存，支持按需重新验证
export const dynamic = "force-dynamic"; // 允许按需重新验证
